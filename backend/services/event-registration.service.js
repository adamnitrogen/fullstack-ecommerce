const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const emailService = require('./email');
const { createInvoice } = require('../services/razorpay-invoice.service');
const { capturePayment, voidAuthorization, refundPayment, fetchPayment } = require('../utils/razorpay-helper');
const EventPricingService = require('./event-pricing.service');
const EventRefundService = require('./event-refund.service');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Event Registration Service
 * Handles event registration, payments, and cancellations.
 */
class EventRegistrationService {

    /**
     * Generate unique registration number
     * Format: EVT-YYYYMMDD-XXXX (e.g., EVT-20260106-0001)
     */
    static async generateRegistrationNumber() {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `EVT-${dateStr}-`;

        const { data: lastReg } = await supabase
            .from('event_registrations')
            .select('registration_number')
            .like('registration_number', `${prefix}%`)
            .order('registration_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        let nextNumber = 1;
        if (lastReg?.registration_number) {
            const lastPart = lastReg.registration_number.slice(-4);
            const lastCounter = parseInt(lastPart, 10);
            if (!isNaN(lastCounter)) {
                nextNumber = lastCounter + 1;
            }
        }

        return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
    }

    /**
     * Create Registration Order (Free or Paid)
     */
    static async createRegistrationOrder(userId, { eventId, fullName, email, phone }) {
        if (!eventId || !fullName || !email || !phone) {
            throw new Error('Event ID, full name, email, and phone are required');
        }

        // Get event details
        // Check for duplicate registration
        if (userId) {
            const { data: existingReg } = await supabase
                .from('event_registrations')
                .select('id, status')
                .eq('user_id', userId)
                .eq('event_id', eventId)
                .neq('status', 'cancelled')
                .neq('status', 'refunded')
                .neq('status', 'failed')
                .maybeSingle();

            if (existingReg) {
                // If status is pending (payment failed or abandoned), cancel it and allow retry
                if (existingReg.status === 'pending') {
                    logger.info({ userId, eventId, oldRegId: existingReg.id }, '[EventRegistration] Auto-cancelling pending registration to allow retry');
                    await supabase
                        .from('event_registrations')
                        .update({
                            status: 'cancelled',
                            cancellation_reason: 'System: User retrying registration',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingReg.id);
                } else {
                    logger.info({ userId, eventId, status: existingReg.status }, '[EventRegistration] Prevented duplicate registration');
                    throw new Error('You are already registered for this event.');
                }
            }
        }

        // Get event details
        logger.debug({ eventId }, '[EventRegistration] Fetching event');

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, registration_amount, gst_rate, base_price, gst_amount, registration_deadline, start_date, location, description, event_code, status, cancellation_status')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            throw new Error('Event not found');
        }

        // Check if event is cancelled
        if (event.status === 'cancelled' || event.cancellation_status === 'CANCELLED' || event.cancellation_status === 'CANCELLATION_PENDING') {
            throw new Error('This event has been cancelled and is no longer accepting registrations.');
        }

        // Check Registration Deadline
        if (event.registration_deadline) {
            // "From that day onwards user is not able to register anymore"
            // Means if deadline is 2026-01-24, registration closes at 00:00:00 on 2026-01-24
            const deadline = new Date(event.registration_deadline);
            // Reset deadline time to start of day just to be safe, though usage usually sets it to midnight
            deadline.setHours(0, 0, 0, 0);

            if (Date.now() >= deadline.getTime()) {
                logger.warn({ eventId, deadline: event.registration_deadline }, '[EventRegistration] Attempted registration after deadline (strict)');
                throw new Error('Registration for this event is closed.');
            }
        }

        // Generate Registration Number
        const prefix = `EVT-${event.title.substring(0, 3).toUpperCase()}-`;
        const registrationNumber = await this.generateRegistrationNumber(prefix);

        // Check if free event
        const isFree = !event.registration_amount || event.registration_amount === 0;

        // Calculate Payment Breakdown (if missing in event)
        let basePrice = event.base_price;
        let gstAmount = event.gst_amount;
        let gstRate = event.gst_rate;

        if (!isFree && (!basePrice || !gstAmount)) {
            // Calculate on the fly
            const breakdown = EventPricingService.calculateBreakdown(event.registration_amount, event.gst_rate);
            basePrice = breakdown.basePrice;
            gstAmount = breakdown.gstAmount;
            gstRate = breakdown.gstRate;

            logger.info({
                registrationAmount: event.registration_amount,
                calculatedBase: basePrice,
                calculatedGst: gstAmount
            }, '[EventRegistration] Calculated missing tax breakdown');
        }

        // Create initial registration record
        const { data: registration, error: regError } = await supabase
            .from('event_registrations')
            .insert([{
                registration_number: registrationNumber,
                event_id: eventId,
                user_id: userId,
                full_name: fullName,
                email,
                phone,
                amount: isFree ? 0 : event.registration_amount,
                gst_rate: isFree ? 0 : gstRate,
                base_price: isFree ? 0 : basePrice,
                gst_amount: isFree ? 0 : gstAmount,
                payment_status: isFree ? 'free' : 'pending',
                status: isFree ? 'confirmed' : 'pending',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (regError) {
            logger.error('Failed to create registration record', {
                module: 'EventRegistration',
                operation: 'CREATE_ORDER',
                err: regError,
                userId,
                eventId
            });
            throw new Error('Failed to create registration record: ' + regError.message);
        }

        // --- FREE EVENT FLOW ---
        if (isFree) {
            // Send confirmation email
            emailService.sendEventRegistrationEmail(
                email,
                {
                    event: {
                        id: eventId,
                        title: event.title,
                        startDate: event.start_date,
                        location: event.location,
                        description: event.description,
                        eventCode: event.event_code
                    },
                    registration: {
                        id: registration.id,
                        registrationNumber: registration.registration_number
                    },
                    attendeeName: fullName,
                    isPaid: false
                },
                userId
            ).catch(err => logger.error({ err: err.message }, 'Failed to send free event email'));

            return {
                success: true,
                isFree: true,
                registration: {
                    id: registration.id,
                    registrationNumber: registration.registration_number
                }
            };
        }

        // --- PAID EVENT FLOW ---
        // Create Razorpay INVOICE (replaces simple Order)
        // This generates a detailed PDF Invoice + Receipt linked to the payment
        const invoiceResult = await createInvoice({
            paymentId: null, // No payment ID yet
            amount: event.registration_amount,
            customerName: fullName,
            customerEmail: email,
            customerPhone: phone,
            receiptNumber: registration.registration_number,
            description: `Registration: ${event.title}`
        });

        if (!invoiceResult.success) {
            logger.error({ err: invoiceResult.error, registrationId: registration.id }, '[EventRegistration] Failed to create Razorpay invoice');
            // We continue but the user won't have a nice invoice link yet. 
            // However, we NEED the order_id for the checkout to work.
            // If invoice creation fails, we might need to fallback or fail the registration.
            // For now, let's fail to ensure consistency.
            throw new Error('Failed to initiate payment gateway. Please try again.');
        }

        logger.info({ invoiceResult }, '[EventRegistration] Invoice created successfully');

        // Update registration with invoice details immediately
        const { error: updateError } = await supabase
            .from('event_registrations')
            .update({
                invoice_id: invoiceResult.invoiceId,
                invoice_url: invoiceResult.invoiceUrl,
                razorpay_order_id: invoiceResult.orderId // Store Order ID for verification
            })
            .eq('id', registration.id);

        if (updateError) {
            logger.error({ err: updateError, registrationId: registration.id }, '[EventRegistration] Failed to save invoice URL to DB');
            // Validate if column exists error
            if (updateError.code === '42703') { // Undefined column
                logger.warn('Column invoice_url might be missing. Proceeding without saving it.');
            }
        }

        return {
            success: true,
            isFree: false,
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: Math.round(event.registration_amount * 100),
            currency: 'INR',
            order_id: invoiceResult.orderId, // CRITICAL: Frontend expects Order ID linked to Invoice
            invoice_id: invoiceResult.invoiceId, // Pass Invoice ID so frontend can return it for verification
            registration_id: registration.id,
            registration: {
                registrationNumber: registration.registration_number
            }
        };
    }

    /**
     * Verify Payment and Confirm Registration - AUTO CAPTURE PATTERN
     * 
     * 1. Verify signature
     * 2. Payment is ALREADY CAPTURED
     * 3. Run DB transaction (update registration status)
     * 4. If DB succeeds → All good
     * 5. If DB fails → REFUND payment
     */
    static async verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, registration_id, razorpay_invoice_id }) {
        logger.info({
            razorpay_payment_id,
            razorpay_order_id,
            registration_id,
            has_signature: !!razorpay_signature,
            has_invoice_id: !!razorpay_invoice_id
        }, '[EventRegistration] Starting payment verification');

        // Relaxed check: We NEED payment_id and registration_id. The rest can be fetched via S2S if missing.
        if (!razorpay_payment_id || !registration_id) {
            logger.error({ razorpay_payment_id, registration_id }, '[EventRegistration] Missing critical verification parameters');
            throw new Error('Missing payment verification parameters');
        }

        // Fetch registration for amount - GET FULL EVENT DETAILS
        const { data: regData, error: fetchError } = await supabase
            .from('event_registrations')
            .select('*, events!inner(*)') // Fetch ALL event fields
            .eq('id', registration_id)
            .single();

        if (fetchError || !regData) {
            logger.error({ err: fetchError, registration_id }, '[EventRegistration] Registration not found during verify');
            throw new Error('Registration not found');
        }

        // define registration alias for consistency with downstream code
        const registration = regData;

        // Initial amount (might be updated by RPC later)
        let amount = regData.amount || regData.events?.registration_amount || 0;
        let isSignatureVerified = false;

        // 1. Signature Verification (Preferred if all params present)
        if (razorpay_order_id && razorpay_signature) {
            try {
                const generated_signature = crypto
                    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                    .update(razorpay_order_id + '|' + razorpay_payment_id)
                    .digest('hex');

                if (generated_signature === razorpay_signature) {
                    isSignatureVerified = true;
                    logger.info({ razorpay_payment_id }, '[EventRegistration] Signature verification successful');
                } else {
                    logger.warn({
                        razorpay_payment_id,
                        expected: generated_signature,
                        received: razorpay_signature
                    }, '[EventRegistration] Signature mismatch. Falling back to S2S verification.');
                }
            } catch (sigErr) {
                logger.error({ err: sigErr }, '[EventRegistration] Signature check error');
            }
        } else {
            logger.info('[EventRegistration] Missing checks for signature verification. Proceeding to S2S check.');
        }

        // 2. S2S Verification (Fallback / Source of Truth)
        if (!isSignatureVerified) {
            try {
                logger.info({ razorpay_payment_id }, '[EventRegistration] Initiating S2S verification fetch');
                const payment = await razorpay.payments.fetch(razorpay_payment_id);

                logger.info({
                    id: payment.id,
                    status: payment.status,
                    amount: payment.amount,
                    order_id: payment.order_id,
                    email: payment.email
                }, '[EventRegistration] S2S Payment Details Fetched');

                // Check Status
                if (payment.status !== 'captured' && payment.status !== 'authorized') {
                    throw new Error(`Payment status is ${payment.status} (expected captured/authorized)`);
                }

                // Verify Amount (Prevent manipulation)
                const expectedAmount = Math.round(amount * 100);
                if (payment.amount !== expectedAmount) {
                    logger.error({
                        expected: expectedAmount,
                        received: payment.amount
                    }, '[EventRegistration] Payment amount mismatch');
                    throw new Error('Payment amount does not match registration amount');
                }

                // If we have an order_id on record, it MUST match the payment's order_id if present
                if (razorpay_order_id && payment.order_id && payment.order_id !== razorpay_order_id) {
                    logger.error({
                        payment_order_id: payment.order_id,
                        input_order_id: razorpay_order_id
                    }, '[EventRegistration] Order ID mismatch');
                    throw new Error('Order ID mismatch');
                }

                // If the input didn't have an order_id (null case), we adopt the one from payment
                if (!razorpay_order_id && payment.order_id) {
                    razorpay_order_id = payment.order_id;
                    logger.info({ razorpay_order_id }, '[EventRegistration] Adopted Order ID from S2S payment');
                }

                isSignatureVerified = true; // S2S is authoritative
                logger.info('[EventRegistration] S2S Verification PASSED');

            } catch (s2sError) {
                logger.error({ err: s2sError, razorpay_payment_id }, '[EventRegistration] S2S Verification FAILED');
                throw new Error(`Payment verification failed: ${s2sError.message}`);
            }
        }

        // --- PAYMENT VERIFIED (Either Signature or S2S) ---

        // Auto-Capture check (if somehow authorized but not captured)
        // Note: We used payment_capture=1 so it should be captured, but good to be safe.
        // We update status to 'captured' locally.

        await supabase
            .from('event_registrations')
            .update({
                payment_status: 'captured',
                updated_at: new Date().toISOString()
            })
            .eq('id', registration_id);

        let receiptUrl = null;

        // --- DB TRANSACTION PHASE ---
        try {
            // 3. Update Registration Status - TRANSACTIONAL VERSION
            // We pass null for invoice_url because we rely on the one generated during createRegistrationOrder
            // We pass our verified (or adopted) razorpay parameters
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('verify_event_registration_transactional', {
                    p_registration_id: registration_id,
                    p_razorpay_payment_id: razorpay_payment_id,
                    p_razorpay_signature: razorpay_signature || 's2s_verified', // specific marker if sig missing
                    p_invoice_url: null
                });

            if (rpcError) {
                logger.error({ err: rpcError }, '[EventRegistration] Transactional verification failed:');
                throw new Error('Failed to update registration status: ' + rpcError.message);
            }

            // Update local registration object with RPC result
            if (rpcResult && rpcResult.registration) {
                Object.assign(registration, rpcResult.registration);
            } else {
                // Fallback fetch
                const { data: refreshedReg } = await supabase
                    .from('event_registrations')
                    .select('*, events!inner(*)')
                    .eq('id', registration_id)
                    .single();
                if (refreshedReg) Object.assign(registration, refreshedReg);
            }

            // Consolidate Event Data
            const event = registration.events;
            const eventData = event;

            // Fallback Tax Calculation if missing
            let finalBasePrice = registration.base_price;
            let finalGstAmount = registration.gst_amount;

            if (finalBasePrice === undefined || finalBasePrice === null) {
                const breakdown = EventPricingService.calculateBreakdown(registration.amount, registration.gst_rate);
                finalBasePrice = breakdown.basePrice;
                finalGstAmount = breakdown.gstAmount;
            }

            // Get Invoice URL (should have been set during creation)
            let invoiceUrl = registration.invoice_url;

            // FALLBACK: Recover Invoice URL if missing
            // Priority: DB -> Frontend Argument -> DB Invoice ID -> Razorpay Payment Object
            if (!invoiceUrl) {
                try {
                    // 1. Try to get Invoice ID from anywhere
                    let targetInvoiceId = registration.invoice_id || razorpay_invoice_id;

                    // 2. If missing, and we have a payment ID, fetch the payment to find the linked invoice
                    if (!targetInvoiceId && razorpay_payment_id) {
                        logger.info('[EventRegistration] Invoice ID missing. Fetching payment details to find it.');
                        const payment = await razorpay.payments.fetch(razorpay_payment_id);
                        if (payment && payment.invoice_id) {
                            targetInvoiceId = payment.invoice_id;
                            logger.info({ targetInvoiceId }, '[EventRegistration] Found Invoice ID in payment details');
                        }
                    }

                    if (targetInvoiceId) {
                        logger.info({ invoiceId: targetInvoiceId }, '[EventRegistration] Fetching Invoice URL from Razorpay');
                        const { fetchInvoice } = require('../services/razorpay-invoice.service');
                        const invoiceResult = await fetchInvoice(targetInvoiceId);

                        if (invoiceResult.success && invoiceResult.invoiceUrl) {
                            invoiceUrl = invoiceResult.invoiceUrl;

                            // Opportunistically update the DB
                            // We also update invoice_id if we found it via payment but it wasn't in DB
                            const updates = { invoice_url: invoiceUrl };
                            if (!registration.invoice_id) updates.invoice_id = targetInvoiceId;

                            await supabase
                                .from('event_registrations')
                                .update(updates)
                                .eq('id', registration.id)
                                .then(({ error }) => {
                                    if (error) logger.warn({ err: error }, '[EventRegistration] Failed to backfill invoice details');
                                });
                        }
                    } else {
                        logger.warn('[EventRegistration] Could not find any Invoice ID to recover URL');
                    }
                } catch (fetchErr) {
                    logger.error({ err: fetchErr }, '[EventRegistration] Failed to recover invoice URL');
                }
            }

            // --- DB SUCCESS ---
            logger.info({
                registrationId: registration.id,
                registrationNumber: registration.registration_number,
                paymentId: razorpay_payment_id,
                hasInvoiceUrl: !!invoiceUrl
            }, '[EventRegistration] Registration confirmed successfully in DB');

            // 4. Send Confirmation Email - NON-BLOCKING
            emailService.sendEventRegistrationEmail(
                registration.email,
                {
                    event: {
                        id: eventData.id,
                        title: eventData.title || 'Event',
                        startDate: eventData.start_date,
                        endDate: eventData.end_date,
                        startTime: eventData.start_time,
                        endTime: eventData.end_time,
                        location: eventData.location,
                        description: eventData.description,
                        eventCode: eventData.event_code
                    },
                    registration: {
                        id: registration.id,
                        registrationNumber: registration.registration_number
                    },
                    attendeeName: registration.full_name,
                    isPaid: true,
                    paymentDetails: {
                        amount: registration.amount,
                        basePrice: finalBasePrice,
                        gstAmount: finalGstAmount,
                        gstRate: registration.gst_rate,
                        transactionId: razorpay_payment_id,
                        razorpayPaymentId: razorpay_payment_id,
                        paidAt: new Date().toISOString(),
                        invoiceUrl: invoiceUrl
                    }
                },
                registration.user_id
            ).catch(err => logger.error({ err: err.message }, 'Failed to send paid event registration email'));

            return {
                success: true,
                registration: {
                    id: registration.id,
                    registrationNumber: registration.registration_number,
                    eventTitle: event.title,
                    status: 'confirmed',
                    paymentStatus: 'paid',
                    amount: registration.amount
                }
            };

        } catch (systemError) {
            // --- DB FAILURE: REFUND PAYMENT ---
            logger.error({
                err: systemError,
                stack: systemError.stack,
                razorpay_payment_id,
                registration_id
            }, '[EventRegistration] Verification process failed. Initiating REFUND.');

            const cancellationUpdate = {
                status: 'cancelled',
                updated_at: new Date().toISOString()
            };

            try {
                // Refund the full amount
                await refundPayment(razorpay_payment_id, null, {
                    reason: `Registration update failed: ${systemError.message}`
                });

                // Refund Success: Mark as Refunded + Cancelled
                await supabase
                    .from('event_registrations')
                    .update({
                        ...cancellationUpdate,
                        payment_status: 'refunded'
                    })
                    .eq('id', registration_id);

                logger.info({
                    razorpay_payment_id,
                    registration_id
                }, '[EventRegistration] Payment refunded successfully');

                throw new Error('Registration failed and payment has been refunded. Please try again.');

            } catch (refundError) {
                // Check if this is the success error we just threw
                if (refundError.message.includes('Registration failed')) {
                    throw refundError;
                }

                logger.error({
                    err: refundError,
                    razorpay_payment_id,
                    registration_id
                }, '[EventRegistration] CRITICAL: Failed to refund payment after DB failure!');

                await supabase
                    .from('event_registrations')
                    .update({
                        ...cancellationUpdate
                    })
                    .eq('id', registration_id);

                throw new Error('Registration failed. We encountered an issue refunding your payment. Please contact support immediately.');
            }
        }
    }

    /**
     * Cancel Registration
     */
    static async cancelRegistration(userId, registrationId, reason = 'User requested cancellation') {
        if (!registrationId) throw new Error('Registration ID is required');

        logger.info({
            module: 'EventRegistration',
            operation: 'CANCEL_USER',
            userId,
            registrationId,
            reason
        }, 'User initiated registration cancellation');

        // 1. Verify ownership
        const { data: registration, error: fetchError } = await supabase
            .from('event_registrations')
            .select('*, events(*)')
            .eq('id', registrationId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !registration) throw new Error('Registration not found');
        if (registration.status === 'cancelled') throw new Error('Registration is already cancelled');

        // 2. Deadine Check (48 hours before start)
        const eventStartTime = new Date(registration.events?.start_date).getTime();
        const now = Date.now();
        const fortyEightHoursInMs = 48 * 60 * 60 * 1000;

        if (now > eventStartTime - fortyEightHoursInMs) {
            logger.warn({ registrationId, eventId: registration.event_id, eventStartTime: registration.events?.start_date }, '[EventRegistration] Cancellation blocked: within 48h of event');
            throw new Error('Cancellations are only allowed up to 48 hours before the event start time.');
        }

        // 3. Handle Paid Refund
        let refundSuccessful = false;
        let refundId = null;
        const isPaid = registration.payment_status === 'paid' || registration.payment_status === 'captured';

        if (isPaid && registration.razorpay_payment_id) {
            try {
                logger.info({ registrationId, paymentId: registration.razorpay_payment_id }, '[EventRegistration] Initiating automatic refund for cancellation');

                // 3.1. Create refund record
                const refundRecord = await EventRefundService.initiateRefund({
                    eventId: registration.event_id,
                    userId: registration.user_id,
                    registrationId: registrationId,
                    paymentId: registration.razorpay_payment_id,
                    amount: registration.amount,
                    amount: registration.amount,
                    correlationId: uuidv4() // Generate valid UUID for user cancellation
                });

                if (refundRecord.status === 'INITIATED') {
                    const refund = await refundPayment(registration.razorpay_payment_id, null, {
                        reason: `User cancelled: ${reason}`,
                        registration_id: registrationId,
                        source: 'USER_CANCELLATION'
                    });

                    await EventRefundService.markProcessing(refundRecord.id, refund.id);
                    refundSuccessful = true;
                    refundId = refund.id;
                } else {
                    refundSuccessful = true;
                    refundId = refundRecord.gateway_reference;
                }
            } catch (refundError) {
                logger.error({ err: refundError, registrationId }, '[EventRegistration] Automatic refund failed');
                throw new Error('Failed to process refund. Please contact support.');
            }
        }

        // 4. Update Registration Status
        const { error: updateError } = await supabase
            .from('event_registrations')
            .update({
                status: 'cancelled',
                payment_status: refundSuccessful ? 'refunded' : registration.payment_status,
                cancellation_reason: reason,
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', registrationId);

        if (updateError) {
            logger.error({ err: updateError, registrationId }, '[EventRegistration] Failed to update registration status after cancellation');
            throw updateError;
        }

        // 5. Send cancellation email
        const refundDetails = isPaid ? {
            amount: registration.amount || 0,
            isRefunded: refundSuccessful,
            refundId: refundId
        } : null;

        emailService.sendEventCancellationEmail(
            registration.email,
            {
                event: {
                    id: registration.events?.id,
                    title: registration.events?.title || 'Event',
                    startDate: registration.events?.start_date,
                    location: registration.events?.location,
                    cancellationReason: reason
                },
                registration: { id: registration.id, registrationNumber: registration.registration_number },
                attendeeName: registration.full_name,
                refundDetails
            },
            userId
        ).catch(err => logger.error({ err: err.message }, 'Failed to send event cancellation email'));

        return { success: true, message: 'Registration cancelled successfully' };
    }

    /**
     * Get User Registrations
     */
    static async getUserRegistrations(userId, { page = 1, limit = 5 } = {}) {
        logger.debug({ userId, page }, '[EventRegistration] Fetching user registrations');
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('event_registrations')
            .select(`*, events (id, title, start_date, end_date, location, image)`, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error({ userId, error }, '[EventRegistration] Error fetching user registrations');
            throw error;
        }
        logger.info({ userId, count: data?.length || 0 }, '[EventRegistration] User registrations fetched');

        return {
            registrations: data || [],
            total: count || 0
        };
    }

    /**
     * Get Registration by ID
     */
    static async getRegistrationById(id, userId = null, options = {}) {
        const client = options.useAdmin ? require('../config/supabase').supabaseAdmin : supabase;

        const { data, error } = await client
            .from('event_registrations')
            .select(`*, events (id, title, start_date, end_date, location, image)`)
            .eq('id', id)
            .single();

        if (error || !data) {
            const err = new Error('Registration not found');
            err.statusCode = 404;
            throw err;
        }

        // Access Control (Skip if using admin for public links)
        if (!options.useAdmin && userId && data.user_id && data.user_id !== userId) {
            const err = new Error('Unauthorized');
            err.statusCode = 403;
            throw err;
        }

        return data;
    }
}

module.exports = EventRegistrationService;
