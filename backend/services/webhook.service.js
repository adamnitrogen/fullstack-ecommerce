const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { updatePaymentRecord } = require('./checkout.service');
const emailService = require('./email');

/**
 * Webhook Service
 * Central dispatcher for Razorpay Webhook Events
 */
const webhookService = {
    handleEvent: async (payload) => {
        const { event, payload: data } = payload;
        const payment = data.payment?.entity;

        if (!payment) return;

        logger.info(`Webhook: Processing ${event} for Order ${payment.order_id}`);
        const notes = payment.notes || {};

        try {
            // 1. Check for DONATION
            if (notes.payment_purpose === 'DONATION') {
                await handleDonationWebhook(event, payment, notes);
                return;
            }

            // 2. Check for EVENT REGISTRATION
            if (notes.eventId || notes.eventTitle) {
                await handleEventWebhook(event, payment, notes);
                return;
            }

            // 3. Check for SUBSCRIPTION CHARGE
            if (event.startsWith('subscription.')) {
                await handleSubscriptionWebhook(event, payment, data);
            }

            // 4. Default: E-Commerce ORDER
            if (!event.startsWith('subscription.') && !notes.eventId && !notes.eventTitle) {
                await handleOrderWebhook(event, data, payment);
            }

        } catch (error) {
            logger.error({ err: error }, 'Webhook Handler Error:');
            throw error;
        }
    }
};

/**
 * Handle Donation Webhook
 */
async function handleDonationWebhook(event, payment, notes) {
    if (event === 'payment.captured') {
        const status = payment.status === 'captured' ? 'success' : payment.status;

        // One-Time Donation
        if (notes.donation_type === 'ONE_TIME' && payment.order_id) {
            const { data: updatedDonation, error } = await supabase
                .from('donations')
                .update({
                    payment_status: status,
                    razorpay_payment_id: payment.id,
                    updated_at: new Date().toISOString()
                })
                .eq('razorpay_order_id', payment.order_id)
                .select()
                .single();

            if (error) {
                logger.error({ err: error }, 'Donation Webhook Update Error:');
            } else {
                logger.info(`Donation ${payment.order_id} updated to ${status}`);

                // Send Donation Receipt
                if (status === 'success') {
                    try {
                        const amount = updatedDonation.amount;
                        await emailService.sendDonationReceiptEmail(
                            updatedDonation.donor_email,
                            {
                                donation: updatedDonation,
                                donorName: updatedDonation.donor_name,
                                isAnonymous: updatedDonation.is_anonymous
                            },
                            updatedDonation.user_id
                        );
                    } catch (emailErr) {
                        logger.error({ err: emailErr }, 'Failed to send donation receipt:');
                    }
                }
            }
        }
    }
}

/**
 * Handle Subscription Charged Webhook
 */
async function handleSubscriptionWebhook(event, payment, payload) {
    if (event === 'subscription.charged') {
        const subscription = payload.subscription.entity;

        logger.info(`Processing Subscription Charge: ${subscription.id} for Payment ${payment.id}`);

        const { data: originalDonation, error: fetchError } = await supabase
            .from('donations')
            .select('*')
            .eq('razorpay_subscription_id', subscription.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (fetchError || !originalDonation) {
            logger.error({ err: subscription.id }, 'Subscription Webhook: Original donation not found for');
            return;
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const unique = require('crypto').randomBytes(4).toString('hex').toUpperCase();
        const newRef = `DON-SUB-${dateStr}-${unique}`;

        const { data: newDonation, error: insertError } = await supabase
            .from('donations')
            .insert([{
                donation_reference_id: newRef,
                user_id: originalDonation.user_id,
                type: 'monthly',
                amount: payment.amount / 100,
                donor_name: originalDonation.donor_name,
                donor_email: originalDonation.donor_email,
                donor_phone: originalDonation.donor_phone,
                is_anonymous: originalDonation.is_anonymous,
                payment_status: 'success',
                razorpay_payment_id: payment.id,
                razorpay_subscription_id: subscription.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (insertError) {
            logger.error({ err: insertError }, 'Subscription Webhook: Failed to create recurring record');
        } else {
            logger.info(`Recurring Donation recorded: ${newRef}`);
            // Send Email for Recurring Charge
            try {
                await emailService.sendDonationReceiptEmail(
                    newDonation.donor_email,
                    {
                        donation: newDonation,
                        donorName: newDonation.donor_name,
                        isAnonymous: newDonation.is_anonymous
                    },
                    newDonation.user_id
                );
            } catch (emailErr) {
                logger.error({ err: emailErr }, 'Failed to send recurring donation receipt:');
            }
        }

        const { error: subUpdateError } = await supabase
            .from('donation_subscriptions')
            .update({
                status: 'active',
                current_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : undefined,
                current_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : undefined,
                next_billing_at: subscription.charge_at ? new Date(subscription.charge_at * 1000).toISOString() : undefined,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);

        if (subUpdateError) logger.error({ err: subUpdateError }, 'Subscription Webhook: Failed to update lifecycle status');
    }

    if (event === 'subscription.cancelled' || event === 'subscription.halted' || event === 'subscription.paused') {
        const subscription = payload.subscription.entity;
        const statusMap = {
            'subscription.cancelled': 'cancelled',
            'subscription.halted': 'halted',
            'subscription.paused': 'paused'
        };
        const newStatus = statusMap[event] || 'unknown';

        logger.info(`Subscription ${subscription.id} is now ${newStatus}`);

        await supabase
            .from('donation_subscriptions')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);
    }
}

/**
 * Handle Event Registration Webhook
 */
async function handleEventWebhook(event, payment, notes) {
    if (event === 'payment.captured') {
        const status = payment.status === 'captured' ? 'paid' : 'failed';
        const regStatus = status === 'paid' ? 'confirmed' : 'pending';

        const { data: updatedReg, error } = await supabase
            .from('event_registrations')
            .update({
                payment_status: status,
                razorpay_payment_id: payment.id,
                status: regStatus,
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', payment.order_id)
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, 'Event Webhook Update Error:');
        } else {
            logger.info(`Event Registration ${payment.order_id} updated to ${status}`);

            // Send Event Registration Email
            if (regStatus === 'confirmed') {
                try {
                    // We need event details 
                    const { data: eventDetails } = await supabase
                        .from('events')
                        .select('title, date, location')
                        .eq('id', updatedReg.event_id)
                        .single();

                    if (eventDetails) {
                        await emailService.sendEventRegistrationEmail(
                            updatedReg.email,
                            {
                                event: eventDetails,
                                registration: updatedReg,
                                attendeeName: updatedReg.name
                            },
                            updatedReg.user_id
                        );
                    }
                } catch (emailErr) {
                    logger.error({ err: emailErr }, 'Failed to send event registration email:');
                }
            }
        }
    }
}

/**
 * Handle E-commerce Order Webhook
 */
async function handleOrderWebhook(event, data, payment) {
    if (event === 'payment.captured' && payment) {
        const { data: dbPayment } = await supabase
            .from('payments')
            .select('*')
            .eq('razorpay_order_id', payment.order_id)
            .single();

        if (dbPayment) {
            await updatePaymentRecord(dbPayment.id, {
                status: 'captured',
                razorpay_payment_id: payment.id,
                method: payment.method,
                updated_at: new Date().toISOString()
            });

            if (dbPayment.order_id) {
                const { data: updatedOrder } = await supabase
                    .from('orders')
                    .update({ paymentStatus: 'paid', status: 'confirmed' })
                    .eq('id', dbPayment.order_id)
                    .select('*, order_items(*)')
                    .single();

                // Send Order Confirmation Email
                if (updatedOrder) {
                    try {
                        const items = updatedOrder.order_items || []; // Need to fetch items properly if not selected

                        // We might need to refetch items if not joined above, but let's assume standard order processing
                        // For robustness, let's fetch items explicitly
                        const { data: orderItems } = await supabase
                            .from('order_items')
                            .select('*')
                            .eq('order_id', updatedOrder.id);

                        await emailService.sendOrderConfirmationEmail(
                            updatedOrder.customer_email,
                            {
                                order: updatedOrder,
                                customerName: updatedOrder.customer_name
                            },
                            updatedOrder.user_id
                        );
                    } catch (emailErr) {
                        logger.error({ err: emailErr }, 'Failed to send order confirmation email:');
                    }
                }
            }
            logger.info(`Order Payment ${dbPayment.id} captured`);
        } else {
            logger.warn(`Order Webhook: Payment record not found for ${payment.order_id}`);
        }
    } else if (event === 'payment.failed' && payment) {
        // ... (Keep existing failure handling)
        const { data: dbPayment } = await supabase
            .from('payments')
            .select('*')
            .eq('razorpay_order_id', payment.order_id)
            .single();

        if (dbPayment) {
            await updatePaymentRecord(dbPayment.id, {
                status: 'failed',
                error_description: payment.error_description || 'Payment Failed via Webhook',
                updated_at: new Date().toISOString()
            });
            logger.info(`Order Payment ${dbPayment.id} marked as failed`);
        }
    } else if (event === 'refund.processed' && data.refund) {
        // Refund has been processed by Razorpay - update status to 'refunded'
        const refund = data.refund.entity;
        logger.info(`[Webhook] Refund processed: ${refund.id} for payment ${refund.payment_id}, amount: ₹${refund.amount / 100}`);

        const { data: dbPayment, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('razorpay_payment_id', refund.payment_id)
            .single();

        if (paymentError) {
            logger.error(`[Webhook] Error finding payment for refund:`, paymentError);
            return;
        }

        if (dbPayment) {
            // Update payment status to refunded (only update existing columns)
            await updatePaymentRecord(dbPayment.id, {
                status: 'refunded',
                updated_at: new Date().toISOString()
            });
            logger.info(`[Webhook] Payment ${dbPayment.id} status updated to 'refunded'`);

            // Update order status to refunded
            if (dbPayment.order_id) {
                const { error: orderError } = await supabase
                    .from('orders')
                    .update({
                        paymentStatus: 'refunded',
                        status: 'refunded',
                        updatedAt: new Date().toISOString()
                    })
                    .eq('id', dbPayment.order_id);

                if (orderError) {
                    logger.error(`[Webhook] Error updating order status:`, orderError);
                } else {
                    logger.info(`[Webhook] Order ${dbPayment.order_id} status updated to 'refunded'`);
                }
            }
        } else {
            logger.warn(`[Webhook] Payment not found for Razorpay Payment ID: ${refund.payment_id}`);
        }
    }
}

module.exports = webhookService;
