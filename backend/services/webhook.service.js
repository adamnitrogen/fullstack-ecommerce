const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const { updatePaymentRecord } = require('./checkout.service');
const emailService = require('./email');
const crypto = require('crypto');
const orderService = require('./order.service');
const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');

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
        const unique = crypto.randomBytes(4).toString('hex').toUpperCase();
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
                        .maybeSingle();

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
// ... (imports remain same)

async function handleOrderWebhook(event, payload, payment) {
    if (event === 'payment.captured' && payment) {
        const { data: dbPayment } = await supabase
            .from('payments')
            .select('*')
            .eq('razorpay_order_id', payment.order_id)
            .maybeSingle();

        if (dbPayment) {
            if (dbPayment.status === 'PAYMENT_SUCCESS') {
                logger.info(`Idempotency: Payment ${dbPayment.id} already captured`);
                return;
            }

            await updatePaymentRecord(dbPayment.id, {
                status: 'PAYMENT_SUCCESS', // Standardized robust status
                razorpay_payment_id: payment.id,
                method: payment.method,
                updated_at: new Date().toISOString()
            });

            if (dbPayment.order_id) {
                const { data: updatedOrder } = await supabaseAdmin
                    .from('orders')
                    .update({
                        payment_status: 'paid',
                        status: 'confirmed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', dbPayment.order_id)
                    .select('*, order_items(*)')
                    .single();

                // Log Timeline: PAYMENT_SUCCESS
                await orderService.logStatusHistory(
                    dbPayment.order_id,
                    'PAYMENT_SUCCESS',
                    'SYSTEM',
                    `Payment captured: ${payment.id} via ${payment.method}`
                );

                // Send Order Confirmation Email
                if (updatedOrder) {
                    try {
                        // Check if Razorpay receipt already exists in invoices array
                        const items = updatedOrder.order_items || [];
                        const hasRazorpayReceipt = (updatedOrder.invoices || []).some(inv => inv.type === 'RAZORPAY');
                        if (!hasRazorpayReceipt) {
                            try {
                                logger.info({ orderId: updatedOrder.id }, 'Generating missing Razorpay receipt via webhook');
                                const result = await InvoiceOrchestrator.generateRazorpayInvoice({
                                    ...updatedOrder,
                                    items: items
                                });
                                if (result.success && result.invoiceUrl) {
                                    updatedOrder.invoiceUrl = result.invoiceUrl; // For email template
                                    // NOTE: invoice_url is NOT set here - it's reserved for internal invoice at delivery
                                }
                            } catch (invErr) {
                                logger.warn({ err: invErr }, 'Failed to generate Razorpay receipt in webhook');
                            }
                        }

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
            logger.info(`Order Payment ${dbPayment.id} captured (updated to PAYMENT_SUCCESS)`);
        } else {
            logger.warn(`Order Webhook: Payment record not found for ${payment.order_id}`);
        }
    } else if (event === 'payment.failed' && payment) {
        const { data: dbPayment } = await supabase
            .from('payments')
            .select('*')
            .eq('razorpay_order_id', payment.order_id)
            .maybeSingle();

        if (dbPayment) {
            await updatePaymentRecord(dbPayment.id, {
                status: 'PAYMENT_FAILED',
                error_description: payment.error_description || 'Payment Failed via Webhook',
                updated_at: new Date().toISOString()
            });

            if (dbPayment.order_id) {
                await orderService.logStatusHistory(
                    dbPayment.order_id,
                    'PAYMENT_FAILED',
                    'SYSTEM',
                    `Payment failed: ${payment.error_description || 'Unknown reason'}`
                );
            }
            logger.info(`Order Payment ${dbPayment.id} marked as PAYMENT_FAILED`);
        }
    } else if (event === 'refund.processed' && data.refund) {
        const refundEntity = data.refund.entity;
        logger.info(`[Webhook] Refund processed: ${refundEntity.id} for payment ${refundEntity.payment_id}`);

        // 1. Fetch Payment & Existing Refunds
        const { data: dbPayment, error: paymentError } = await supabase
            .from('payments')
            .select('*, refunds(*)') // Fetch related refunds
            .eq('razorpay_payment_id', refundEntity.payment_id)
            .maybeSingle();

        if (paymentError || !dbPayment) {
            logger.error(`[Webhook] Error finding payment for refund:`, paymentError);
            return;
        }

        const refundAmount = Number(refundEntity.amount) / 100;
        const totalPaid = Number(dbPayment.amount);

        // Calculate total refunded including this new one (if not already recorded in DB sum)
        // We rely on 'total_refunded_amount' column + this current refund if it's the one being processed.
        // However, webhooks are async. Safe way: sum all 'PROCESSED' refunds + this one.
        // Simplest Robust Way: Update this refund status -> Sum all refunds -> Update Payment Status

        // 2. Update Specific Refund Status
        const { data: updatedRefund, error: refundUpdateError } = await supabase
            .from('refunds')
            .update({
                razorpay_refund_status: 'PROCESSED',
                status: 'processed',
                amount: refundAmount, // Ensure strict sync
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_refund_id', refundEntity.id)
            .select() // Return the record to check type
            .single();

        // If refund record doesn't exist (e.g. manual RP dashboard refund), create it?
        // Deployment rule: "Refund type... driven by backend". If missing, it's external.
        if (!updatedRefund && refundUpdateError) {
            logger.warn(`[Webhook] Refund record not found for ${refundEntity.id}. Creating default BUSINESS_REFUND.`);
            // Auto-create for manual dashboard refunds
            await supabase.from('refunds').insert({
                payment_id: dbPayment.id,
                order_id: dbPayment.order_id,
                razorpay_refund_id: refundEntity.id,
                amount: refundAmount,
                refund_type: 'BUSINESS_REFUND', // Default assumption
                razorpay_refund_status: 'PROCESSED',
                status: 'processed',
                reason: 'Manually initiated via Dashboard'
            });
        }

        // 3. Recalculate Totals
        // Fetch valid processed refunds to sum up
        const { data: allRefunds } = await supabase
            .from('refunds')
            .select('amount')
            .eq('payment_id', dbPayment.id)
            .in('razorpay_refund_status', ['PROCESSED']);

        const totalRefunded = allRefunds?.reduce((sum, r) => sum + Number(r.amount), 0) || refundAmount;

        // 4. Determine New Payment Status
        const isFullRefund = totalRefunded >= totalPaid;
        const newPaymentStatus = isFullRefund ? 'REFUND_COMPLETED' : 'REFUND_PARTIAL';

        // 5. Update Payment
        await supabase
            .from('payments')
            .update({
                status: newPaymentStatus,
                total_refunded_amount: totalRefunded,
                updated_at: new Date().toISOString()
            })
            .eq('id', dbPayment.id);

        logger.info(`[Webhook] Payment ${dbPayment.id} updated to ${newPaymentStatus} (Total Refunded: ${totalRefunded})`);

        // 6. Update Order Status & Timeline
        if (dbPayment.order_id) {
            const orderStatus = isFullRefund ? 'refunded' : 'partially_refunded'; // UI mapping

            await supabase
                .from('orders')
                .update({
                    payment_status: orderStatus,
                    status: isFullRefund ? 'refunded' : 'confirmed', // Only full refund cancels order? Or keep confirmed? 
                    // Usually full refund = order refunded. Partial = order still confirmed/delivered but money back.
                    updated_at: new Date().toISOString()
                })
                .eq('id', dbPayment.order_id);

            // Log Timeline match
            const eventType = isFullRefund ? 'REFUND_COMPLETED' : 'REFUND_PARTIAL';
            await orderService.logStatusHistory(
                dbPayment.order_id,
                orderStatus,
                'SYSTEM',
                `Refund processed: ₹${refundAmount}. Total Refunded: ₹${totalRefunded}`,
                'SYSTEM',
                eventType
            );
        }
    }


}

module.exports = webhookService;
