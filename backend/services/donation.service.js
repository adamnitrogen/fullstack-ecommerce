const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { capturePayment, voidAuthorization } = require('../utils/razorpay-helper');
const emailService = require('./email');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Generate unique donation reference ID
 * Format: DON-YYYYMMDD-UUID (short)
 */
function generateDonationRef() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const unique = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `DON-${dateStr}-${unique}`;
}

/**
 * Donation Service
 * Handles One-Time and Monthly Donation logic with Razorpay
 */
class DonationService {

    /**
     * Create One-Time Donation Order
     */
    static async createOneTimeOrder(userId, { amount, donorName, donorEmail, donorPhone, isAnonymous }) {
        if (!amount || amount <= 0) {
            throw new Error('Invalid donation amount');
        }

        const donationRef = generateDonationRef();
        const receipt = `don_${Date.now()}`;

        // Create Razorpay Order with MANUAL CAPTURE
        const orderOptions = {
            amount: Math.round(amount * 100), // in paise
            currency: 'INR',
            receipt,
            payment_capture: 0, // MANUAL CAPTURE - capture only after DB success
            notes: {
                payment_purpose: 'DONATION',
                donation_type: 'ONE_TIME',
                donation_reference_id: donationRef,
                anonymous: isAnonymous ? 'true' : 'false',
                donor_email: isAnonymous ? 'hidden' : donorEmail
            }
        };

        const razorpayOrder = await razorpay.orders.create(orderOptions);

        // Record in Database
        const { data, error } = await supabase
            .from('donations')
            .insert([{
                donation_reference_id: donationRef,
                user_id: userId,
                type: 'one_time',
                amount,
                donor_name: isAnonymous ? 'Anonymous' : donorName,
                donor_email: isAnonymous ? null : donorEmail, // privacy
                donor_phone: isAnonymous ? null : donorPhone,
                is_anonymous: isAnonymous || false,
                payment_status: 'pending',
                razorpay_order_id: razorpayOrder.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        return {
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            donation_ref: donationRef,
            donor_name: isAnonymous ? 'Anonymous' : donorName,
            donor_email: donorEmail,
            donor_contact: donorPhone
        };
    }

    /**
     * Create Monthly Subscription - TRANSACTIONAL VERSION
     * Both DB records are created atomically
     */
    static async createSubscription(userId, { amount, donorName, donorEmail, donorPhone, isAnonymous }) {
        if (!amount || amount <= 0) {
            throw new Error('Invalid donation amount');
        }

        const donationRef = generateDonationRef();

        // 1. Create or Get Plan on Razorpay
        let planId = null;

        try {
            const existingPlans = await razorpay.plans.all({ count: 100 });
            const amountInPaise = Math.round(amount * 100);

            const matchedPlan = existingPlans.items.find(p => {
                return p.item.amount === amountInPaise &&
                    p.item.currency === 'INR' &&
                    p.period === 'monthly' &&
                    Number(p.interval) === 1;
            });

            if (matchedPlan) {
                planId = matchedPlan.id;
            }
        } catch (fetchError) {
            logger.error({ err: fetchError }, 'Failed to fetch existing plans');
        }

        if (!planId) {
            const planOptions = {
                period: 'monthly',
                interval: 1,
                item: {
                    name: `Monthly Donation - ₹${amount}`,
                    amount: Math.round(amount * 100),
                    currency: 'INR',
                    description: 'Monthly contribution to Cow Welfare'
                },
                notes: { type: 'donation_plan' }
            };
            const plan = await razorpay.plans.create(planOptions);
            planId = plan.id;
        }

        // 2. Create Subscription on Razorpay
        const subscriptionOptions = {
            plan_id: planId,
            total_count: 120, // 10 years
            quantity: 1,
            customer_notify: 1,
            notes: {
                payment_purpose: 'DONATION',
                donation_type: 'MONTHLY',
                donation_reference_id: donationRef,
                anonymous: isAnonymous ? 'true' : 'false',
                donor_email: isAnonymous ? 'hidden' : donorEmail,
                initial_amount: amount
            }
        };

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);

        // 3. ATOMIC TRANSACTION: Create both subscription lifecycle and donation intent
        // Uses PostgreSQL function to ensure both inserts succeed or both fail
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('create_subscription_transactional', {
                p_user_id: userId,
                p_donation_ref: donationRef,
                p_razorpay_subscription_id: subscription.id,
                p_razorpay_plan_id: planId,
                p_amount: amount,
                p_donor_name: isAnonymous ? 'Anonymous' : donorName,
                p_donor_email: isAnonymous ? null : donorEmail,
                p_donor_phone: isAnonymous ? null : donorPhone,
                p_is_anonymous: isAnonymous || false
            });

        if (rpcError) {
            logger.error({ err: rpcError }, '[Donation] Transactional subscription creation failed:');

            // Attempt to cancel the Razorpay subscription since DB failed
            try {
                await razorpay.subscriptions.cancel(subscription.id);
                logger.info({ subscriptionId: subscription.id }, '[Donation] Cancelled Razorpay subscription after DB failure');
            } catch (cancelError) {
                logger.error({ err: cancelError, subscriptionId: subscription.id },
                    '[Donation] CRITICAL: Failed to cancel Razorpay subscription after DB failure');
            }

            // User-friendly error message (hide technical details)
            throw new Error('Unable to set up your monthly donation at this time. Please try again later or contact support.');
        }

        logger.info({
            donationRef,
            subscriptionId: subscription.id
        }, '[Donation] Subscription created successfully via transaction');

        // Send subscription confirmation email (async, don't block response)
        if (donorEmail && !isAnonymous) {
            emailService.sendSubscriptionConfirmationEmail(
                donorEmail,
                {
                    subscription: {
                        amount: amount,
                        donationRef: donationRef
                    },
                    donorName: donorName,
                    isAnonymous: isAnonymous
                },
                userId
            ).catch(err => logger.error({ err }, '[Donation] Failed to send subscription confirmation email'));
        }

        return {
            subscription_id: subscription.id,
            key_id: process.env.RAZORPAY_KEY_ID,
            donation_ref: donationRef,
            donor_name: isAnonymous ? 'Anonymous' : donorName,
            donor_email: donorEmail,
            donor_contact: donorPhone
        };
    }

    /**
     * Verify Payment - DELAYED CAPTURE PATTERN
     * 
     * 1. Verify signature (payment is AUTHORIZED, not captured)
     * 2. Run DB transaction (update donation status)
     * 3. If DB succeeds → Capture payment
     * 4. If DB fails → Void authorization (no refund needed!)
     */
    static async verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            throw new Error('Missing payment details');
        }

        // Get donation for amount
        const { data: donation, error: fetchError } = await supabase
            .from('donations')
            .select('amount')
            .eq('razorpay_order_id', razorpay_order_id)
            .single();

        if (fetchError || !donation) {
            throw new Error('Donation not found');
        }

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            await supabase
                .from('donations')
                .update({ payment_status: 'failed' })
                .eq('razorpay_order_id', razorpay_order_id);
            throw new Error('Invalid payment signature');
        }

        // --- PAYMENT SIGNATURE VERIFIED ---
        // Payment is AUTHORIZED but NOT YET CAPTURED
        logger.info({
            razorpay_payment_id,
            razorpay_order_id,
            amount: donation.amount
        }, '[Donation] Payment authorized, proceeding with DB update');

        // Update to authorized status
        await supabase
            .from('donations')
            .update({ payment_status: 'authorized' })
            .eq('razorpay_order_id', razorpay_order_id);

        // --- DB TRANSACTION PHASE ---
        try {
            // Update donation status via transactional RPC
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('verify_donation_transactional', {
                    p_razorpay_order_id: razorpay_order_id,
                    p_razorpay_payment_id: razorpay_payment_id,
                    p_payment_status: 'success'
                });

            if (rpcError) {
                logger.error({ err: rpcError }, '[Donation] Transactional verification failed:');
                throw new Error('Donation update failed: ' + rpcError.message);
            }

            // --- DB SUCCESS: NOW CAPTURE PAYMENT ---
            try {
                logger.info({
                    razorpay_payment_id,
                    amount: donation.amount
                }, '[Donation] DB transaction succeeded, capturing payment');

                await capturePayment(razorpay_payment_id, donation.amount);

                logger.info({
                    donationId: rpcResult.donation.id,
                    donationRef: rpcResult.donation.donation_reference_id
                }, '[Donation] Payment captured successfully');

                // Send donation receipt email (async, don't block response)
                const donationData = rpcResult.donation;
                if (donationData.donor_email) {
                    emailService.sendDonationReceiptEmail(
                        donationData.donor_email,
                        {
                            donation: {
                                id: donationData.donation_reference_id,
                                amount: donationData.amount,
                                createdAt: donationData.created_at
                            },
                            donorName: donationData.donor_name,
                            isAnonymous: donationData.is_anonymous
                        },
                        donationData.user_id
                    ).catch(err => logger.error({ err }, '[Donation] Failed to send receipt email'));
                }

            } catch (captureError) {
                // CRITICAL: DB succeeded but capture failed
                logger.error({
                    err: captureError,
                    razorpay_payment_id,
                    donationId: rpcResult.donation.id
                }, 'CRITICAL: Donation recorded but payment capture failed! Manual intervention required.');
                // Donation is valid, just payment capture needs attention
            }

            return rpcResult.donation;

        } catch (systemError) {
            // --- DB FAILURE: VOID AUTHORIZATION (NO REFUND NEEDED!) ---
            logger.error({
                err: systemError,
                razorpay_payment_id,
                razorpay_order_id
            }, '[Donation] DB update failed. Voiding payment authorization.');

            try {
                await voidAuthorization(razorpay_payment_id, `Donation update failed: ${systemError.message}`);

                await supabase
                    .from('donations')
                    .update({
                        payment_status: 'voided',
                        updated_at: new Date().toISOString()
                    })
                    .eq('razorpay_order_id', razorpay_order_id);

                logger.info({
                    razorpay_payment_id,
                    razorpay_order_id
                }, '[Donation] Payment authorization voided successfully');

                throw new Error('Donation processing failed. Your payment was not processed. Please try again.');

            } catch (voidError) {
                if (voidError.message.includes('was not processed')) {
                    throw voidError;
                }

                logger.error({
                    err: voidError,
                    razorpay_payment_id,
                    razorpay_order_id
                }, '[Donation] Failed to void authorization. Payment will auto-void in 5 days.');

                throw new Error('Donation processing failed. Your payment authorization will be released automatically. Please try again.');
            }
        }
    }

    /**
     * Process Webhook
     */
    static async processWebhook(signature, body) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(JSON.stringify(body));
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            throw new Error('Invalid signature');
        }

        const event = body.event;
        const payload = body.payload;

        if (event === 'payment.captured') {
            const payment = payload.payment.entity;
            const notes = payment.notes;

            if (notes.payment_purpose === 'DONATION') {
                const status = payment.status === 'captured' ? 'success' : payment.status;

                if (notes.donation_type === 'ONE_TIME' && payment.order_id) {
                    await supabase
                        .from('donations')
                        .update({
                            payment_status: status,
                            razorpay_payment_id: payment.id,
                            updated_at: new Date().toISOString()
                        })
                        .eq('razorpay_order_id', payment.order_id);
                }
            }
        }
        else if (event === 'subscription.charged') {
            const subscription = payload.subscription.entity;
            const payment = payload.payment.entity;
            const donationRef = generateDonationRef();
            const amount = payment.amount / 100;

            // Log new recurring donation
            const { data: newDonation, error: insertError } = await supabase
                .from('donations')
                .insert([{
                    donation_reference_id: donationRef,
                    type: 'monthly',
                    amount: amount,
                    razorpay_payment_id: payment.id,
                    razorpay_subscription_id: subscription.id,
                    payment_status: 'success',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                logger.error({ err: insertError }, '[Donation] Failed to log recurring donation');
                return;
            }

            // Fetch subscription details to get donor email
            const { data: subscriptionRecord } = await supabase
                .from('donation_subscriptions')
                .select('donor_email, donor_name, is_anonymous, user_id, status')
                .eq('razorpay_subscription_id', subscription.id)
                .single();

            // Update subscription status to 'active' if it was 'created' (first payment)
            // Also update next_billing_at from Razorpay's charge_at timestamp
            if (subscriptionRecord && subscriptionRecord.status === 'created') {
                const nextBillingAt = subscription.charge_at
                    ? new Date(subscription.charge_at * 1000).toISOString()
                    : null;

                await supabase
                    .from('donation_subscriptions')
                    .update({
                        status: 'active',
                        next_billing_at: nextBillingAt,
                        updated_at: new Date().toISOString()
                    })
                    .eq('razorpay_subscription_id', subscription.id);

                logger.info({ subscriptionId: subscription.id, nextBillingAt }, '[Donation] Subscription activated after first payment');
            } else if (subscriptionRecord) {
                // For subsequent payments, just update the next billing date
                const nextBillingAt = subscription.charge_at
                    ? new Date(subscription.charge_at * 1000).toISOString()
                    : null;

                if (nextBillingAt) {
                    await supabase
                        .from('donation_subscriptions')
                        .update({
                            next_billing_at: nextBillingAt,
                            updated_at: new Date().toISOString()
                        })
                        .eq('razorpay_subscription_id', subscription.id);
                }
            }

            // Send donation receipt email for recurring payment
            if (subscriptionRecord && subscriptionRecord.donor_email && !subscriptionRecord.is_anonymous) {
                emailService.sendDonationReceiptEmail(
                    subscriptionRecord.donor_email,
                    {
                        donation: {
                            id: donationRef,
                            amount: amount,
                            createdAt: new Date().toISOString()
                        },
                        donorName: subscriptionRecord.donor_name,
                        isAnonymous: subscriptionRecord.is_anonymous
                    },
                    subscriptionRecord.user_id
                ).catch(err => logger.error({ err }, '[Donation] Failed to send recurring donation receipt'));
            }

            logger.info({
                donationRef,
                subscriptionId: subscription.id,
                amount
            }, '[Donation] Recurring payment processed and email sent');
        }
    }

    /**
     * Create QR Code
     */
    static async createQRCode() {
        const qrCode = await razorpay.qrCode.create({
            type: 'upi_qr',
            name: 'Cow Welfare Anonymous',
            usage: 'multiple_use',
            fixed_amount: false,
            description: 'Anonymous Donation for Cow Welfare',
            notes: { payment_purpose: 'ANONYMOUS_DONATION' }
        });

        return {
            qr_code_url: qrCode.image_url,
            id: qrCode.id
        };
    }

    /**
     * Get User Subscriptions
     */
    static async getUserSubscriptions(userId) {
        const { data, error } = await supabase
            .from('donation_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Cancel Subscription - TRANSACTIONAL VERSION
     * Uses RPC for atomic status validation and update
     */
    static async cancelSubscription(userId, subscriptionId) {
        // First, cancel on Razorpay
        try {
            await razorpay.subscriptions.cancel(subscriptionId);
        } catch (razorpayError) {
            // If Razorpay says already cancelled, that's fine
            if (!razorpayError.message?.includes('already cancelled')) {
                throw razorpayError;
            }
        }

        // Then update DB atomically with validation
        const { data: subscription, error: rpcError } = await supabase
            .rpc('update_subscription_status_transactional', {
                p_user_id: userId,
                p_razorpay_subscription_id: subscriptionId,
                p_new_status: 'cancelled',
                p_action: 'cancel'
            });

        if (rpcError) {
            logger.error({
                err: rpcError,
                subscriptionId
            }, '[Donation] CRITICAL: Razorpay subscription cancelled but DB update failed');
            throw new Error(`Failed to update subscription status: ${rpcError.message}`);
        }

        // Send cancellation email (async)
        if (subscription && subscription.donor_email) {
            emailService.sendSubscriptionCancellationEmail(
                subscription.donor_email,
                {
                    subscription: {
                        amount: subscription.amount,
                        donationRef: subscription.donation_reference_id
                    },
                    donorName: subscription.donor_name
                },
                userId
            ).catch(err => logger.error({ err }, '[Donation] Failed to send subscription cancellation email'));
        }

        logger.info({ subscriptionId }, '[Donation] Subscription cancelled successfully');
        return true;
    }

    /**
     * Pause Subscription - TRANSACTIONAL VERSION
     * Uses RPC for atomic status validation and update
     */
    static async pauseSubscription(userId, subscriptionId) {
        // First, pause on Razorpay
        await razorpay.subscriptions.pause(subscriptionId, { pause_at: 'now' });

        // Then update DB atomically with validation
        const { data: result, error: rpcError } = await supabase
            .rpc('update_subscription_status_transactional', {
                p_user_id: userId,
                p_razorpay_subscription_id: subscriptionId,
                p_new_status: 'paused',
                p_action: 'pause'
            });

        if (rpcError) {
            logger.error({
                err: rpcError,
                subscriptionId
            }, '[Donation] CRITICAL: Razorpay subscription paused but DB update failed');

            // Attempt to resume the subscription since DB failed
            try {
                await razorpay.subscriptions.resume(subscriptionId, { resume_at: 'now' });
                logger.info({ subscriptionId }, '[Donation] Rolled back Razorpay pause after DB failure');
            } catch (rollbackError) {
                logger.error({ err: rollbackError, subscriptionId },
                    '[Donation] CRITICAL: Failed to rollback Razorpay pause');
            }

            throw new Error(`Failed to update subscription status: ${rpcError.message}`);
        }

        logger.info({ subscriptionId }, '[Donation] Subscription paused successfully');
        return true;
    }

    /**
     * Resume Subscription - TRANSACTIONAL VERSION
     * Uses RPC for atomic status validation and update
     */
    static async resumeSubscription(userId, subscriptionId) {
        // First, resume on Razorpay
        await razorpay.subscriptions.resume(subscriptionId, { resume_at: 'now' });

        // Then update DB atomically with validation
        const { data: result, error: rpcError } = await supabase
            .rpc('update_subscription_status_transactional', {
                p_user_id: userId,
                p_razorpay_subscription_id: subscriptionId,
                p_new_status: 'active',
                p_action: 'resume'
            });

        if (rpcError) {
            logger.error({
                err: rpcError,
                subscriptionId
            }, '[Donation] CRITICAL: Razorpay subscription resumed but DB update failed');

            // Attempt to pause the subscription since DB failed
            try {
                await razorpay.subscriptions.pause(subscriptionId, { pause_at: 'now' });
                logger.info({ subscriptionId }, '[Donation] Rolled back Razorpay resume after DB failure');
            } catch (rollbackError) {
                logger.error({ err: rollbackError, subscriptionId },
                    '[Donation] CRITICAL: Failed to rollback Razorpay resume');
            }

            throw new Error(`Failed to update subscription status: ${rpcError.message}`);
        }

        logger.info({ subscriptionId }, '[Donation] Subscription resumed successfully');
        return true;
    }
}

module.exports = DonationService;
