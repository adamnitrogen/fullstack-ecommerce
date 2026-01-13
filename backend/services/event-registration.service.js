const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const emailService = require('../services/email');
const { createInvoice } = require('../services/razorpay-invoice.service');
const { capturePayment, voidAuthorization } = require('../utils/razorpay-helper');

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
                logger.info({ userId, eventId, status: existingReg.status }, '[EventRegistration] Prevented duplicate registration');
                throw new Error('You are already registered for this event.');
            }
        }

        // Get event details
        // Debug logging
        // console.log(`[EventRegistration] Fetching event with ID: ${eventId}`);

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, registration_amount, start_date, location, description, event_code, status, cancellation_status')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            throw new Error('Event not found');
        }

        // Check if event is cancelled
        if (event.status === 'cancelled' || event.cancellation_status === 'CANCELLED' || event.cancellation_status === 'CANCELLATION_PENDING') {
            throw new Error('This event has been cancelled and is no longer accepting registrations.');
        }

        // Generate Registration Number
        const prefix = `EVT-${event.title.substring(0, 3).toUpperCase()}-`;
        const registrationNumber = await this.generateRegistrationNumber(prefix);

        // Check if free event
        const isFree = !event.registration_amount || event.registration_amount === 0;

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
                payment_status: isFree ? 'free' : 'pending',
                status: isFree ? 'confirmed' : 'pending',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (regError) {
            console.error('Registration Insert Error:', regError);
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
        // Create Razorpay Order with AUTO CAPTURE
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(event.registration_amount * 100), // Amount in paise
            currency: 'INR',
            receipt: registration.registration_number,
            payment_capture: 1, // AUTO CAPTURE - capture immediately
            notes: {
                registration_id: registration.id,
                event_id: eventId,
                event_title: event.title
            }
        });

        return {
            success: true,
            isFree: false,
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            order_id: razorpayOrder.id,
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
    static async verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, registration_id }) {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !registration_id) {
            throw new Error('Missing payment verification parameters');
        }

        // Fetch registration for amount
        const { data: regData, error: fetchError } = await supabase
            .from('event_registrations')
            .select('*, events(title, registration_amount)')
            .eq('id', registration_id)
            .single();

        if (fetchError || !regData) {
            throw new Error('Registration not found');
        }

        const amount = regData.amount || regData.events?.registration_amount || 0;

        // 1. Verify Signature
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            throw new Error('Invalid payment signature');
        }

        // --- PAYMENT SIGNATURE VERIFIED ---
        // Payment is ALREADY CAPTURED (Auto-Capture)
        logger.info({
            razorpay_payment_id,
            registration_id,
            amount
        }, '[EventRegistration] Payment signature verified (Auto-captured), proceeding with DB update');

        // Update to captured status initially (since it IS captured by Razorpay)
        await supabase
            .from('event_registrations')
            .update({ payment_status: 'captured' })
            .eq('id', registration_id);

        // --- DB TRANSACTION PHASE ---
        try {
            // 2. Generate Invoice (Optional but recommended)
            let invoiceUrl = null;
            try {
                invoiceUrl = await createInvoice({
                    customer: {
                        name: regData.full_name,
                        email: regData.email,
                        contact: regData.phone
                    },
                    lineItems: [{
                        name: `Registration: ${regData.events?.title}`,
                        amount: amount,
                        currency: 'INR',
                        quantity: 1
                    }],
                    referenceId: regData.registration_number
                });
            } catch (invErr) {
                logger.error({ err: invErr }, 'Failed to generate invoice during verification');
            }

            // 3. Update Registration Status - TRANSACTIONAL VERSION
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('verify_event_registration_transactional', {
                    p_registration_id: registration_id,
                    p_razorpay_payment_id: razorpay_payment_id,
                    p_razorpay_signature: razorpay_signature,
                    p_invoice_url: invoiceUrl
                });

            if (rpcError) {
                logger.error({ err: rpcError }, '[EventRegistration] Transactional verification failed:');
                throw new Error('Failed to update registration status: ' + rpcError.message);
            }

            const registration = rpcResult.registration;
            const event = rpcResult.event;

            // --- DB SUCCESS ---
            logger.info({
                registrationId: registration.id,
                registrationNumber: registration.registration_number
            }, '[EventRegistration] Registration confirmed successfully');

            // 4. Send Confirmation Email
            emailService.sendEventRegistrationEmail(
                registration.email,
                {
                    event: {
                        id: event.id,
                        title: event.title || 'Event',
                        startDate: event.start_date,
                        location: event.location,
                        description: event.description,
                        eventCode: event.event_code
                    },
                    registration: {
                        id: registration.id,
                        registrationNumber: registration.registration_number
                    },
                    attendeeName: registration.full_name,
                    isPaid: true,
                    paymentDetails: {
                        amount: registration.amount,
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
                    status: registration.status,
                    paymentStatus: registration.payment_status,
                    amount: registration.amount
                }
            };

        } catch (systemError) {
            // --- DB FAILURE: REFUND PAYMENT ---
            logger.error({
                err: systemError,
                razorpay_payment_id,
                registration_id
            }, '[EventRegistration] DB update failed. Initiating REFUND.');

            // Mark as cancelled immediately in case refund fails logic below
            // We will update payment_status to 'refunded' if successful, otherwise it remains 'captured' (indicating manual refund needed)
            const cancellationUpdate = {
                status: 'cancelled',
                updated_at: new Date().toISOString()
            };

            try {
                // Refund the full amount
                const { refundPayment } = require('../utils/razorpay-helper');
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

                // Refund Failed: Mark as Cancelled (so admin sees it)
                // Payment status stays 'captured' or whatever it was, signaling manual intervention
                await supabase
                    .from('event_registrations')
                    .update({
                        ...cancellationUpdate
                        // payment_status left as is (likely 'captured') so admin knows to look at it
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

        // Block cancellation for paid events (Backend Policy)
        if (registration.payment_status === 'paid' || registration.payment_status === 'captured') {
            throw new Error('Paid event registrations cannot be cancelled online. Please contact support for refund requests.');
        }

        // 2. Cancellation
        const { error: updateError } = await supabase
            .from('event_registrations')
            .update({
                status: 'cancelled',
                cancellation_reason: reason,
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', registrationId);

        if (updateError) throw updateError;

        // 3. Send cancellation email
        const refundDetails = (registration.payment_status === 'paid' || registration.payment_status === 'captured') ? {
            amount: registration.amount || 0,
            isRefunded: false
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
        // console.log(`[EventRegistration] Fetching registrations for user: ${userId} page: ${page}`);
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
    static async getRegistrationById(id, userId = null) {
        const { data, error } = await supabase
            .from('event_registrations')
            .select(`*, events (id, title, start_date, end_date, location, image)`)
            .eq('id', id)
            .single();

        if (error || !data) throw new Error('Registration not found');

        // Access Control
        if (userId && data.user_id && data.user_id !== userId) {
            throw new Error('Unauthorized');
        }

        return data;
    }
}

module.exports = EventRegistrationService;
