const Razorpay = require('razorpay');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { logStatusHistory } = require('./history.service');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const REFUND_TYPES = {
    BUSINESS_REFUND: 'BUSINESS_REFUND',
    TECHNICAL_REFUND: 'TECHNICAL_REFUND'
};

/**
 * Refund Service
 * Handles complex refund logic distinguishing between business and technical refunds.
 */
class RefundService {
    /**
     * Calculate's the eligible refund amount based on business rules.
     * @param {object} order - The order object from DB
     * @param {string} refundType - BUSINESS_REFUND or TECHNICAL_REFUND
     * @param {Array} items - Optional: Order items with snapshots for granular calculation
     */
    static calculateRefundAmount(order, refundType, items = []) {
        const totalAmount = Number(order.total_amount || 0);

        if (refundType === REFUND_TYPES.TECHNICAL_REFUND) {
            return {
                amount: totalAmount,
                excludedCharge: 0,
                excludedGst: 0,
                isFullRefund: true
            };
        }

        // BUSINESS_REFUND: Check policy
        // If items are provided, use granular item-level policy
        if (items && items.length > 0) {
            let excludedCharge = 0;
            let excludedGst = 0;

            items.forEach(item => {
                const snapshot = item.delivery_calculation_snapshot || {};

                // Priority 1: Full policy exclusion (Surcharge Non-Refundable OR Global Non-Refundable)
                if (snapshot.delivery_refund_policy === 'NON_REFUNDABLE') {
                    excludedCharge += Number(item.delivery_charge || 0);
                    excludedGst += Number(item.delivery_gst || 0);
                }
                // Priority 2: Explicit partial component (Hybrid: Refundable Surcharge + Non-Refundable Global)
                else if (snapshot.non_refundable_delivery_charge) {
                    excludedCharge += Number(snapshot.non_refundable_delivery_charge || 0);
                    excludedGst += Number(snapshot.non_refundable_delivery_gst || 0);
                }
            });

            const refundAmount = totalAmount - excludedCharge - excludedGst;

            return {
                amount: Math.max(0, Math.round(refundAmount * 100) / 100),
                excludedCharge,
                excludedGst,
                isFullRefund: (excludedCharge + excludedGst) === 0
            };
        }

        // Fallback: Use order-level flag (Legacy/Simpler behavior)
        const deliveryCharge = Number(order.delivery_charge || 0);
        const deliveryGst = Number(order.delivery_gst || 0);
        const isDeliveryRefundable = order.is_delivery_refundable !== false; // Default true

        if (!isDeliveryRefundable) {
            const excludedCharge = deliveryCharge;
            const excludedGst = deliveryGst;
            const refundAmount = totalAmount - excludedCharge - excludedGst;

            return {
                amount: Math.max(0, Math.round(refundAmount * 100) / 100),
                excludedCharge,
                excludedGst,
                isFullRefund: false
            };
        }

        return {
            amount: totalAmount,
            excludedCharge: 0,
            excludedGst: 0,
            isFullRefund: true
        };
    }

    /**
     * Orchestrates the refund process: calculation, Razorpay call, and audit logging.
     * @param {string} identifier - orderId or paymentId (internal UUIDs)
     * @param {string} refundType 
     * @param {string} initiatedBy - 'SYSTEM', 'ADMIN', 'USER'
     * @param {string} reason 
     * @param {boolean} isInternalPaymentId - If true, identifier is paymentId instead of orderId
     * @param {number} overrideAmount - Optional custom amount (for partial returns)
     */
    static async asyncProcessRefund(identifier, refundType, initiatedBy = 'SYSTEM', reason = '', isInternalPaymentId = false, overrideAmount = null) {
        try {
            logger.info(`[RefundService] Starting ${refundType} for identifier: ${identifier}${overrideAmount ? ` (Override: ${overrideAmount})` : ''}`);

            let order = null;
            let payment = null;

            // 1. Fetch Order and Payment Details
            if (isInternalPaymentId) {
                const { data: paymentRecord, error: pError } = await supabase
                    .from('payments')
                    .select('*, orders(*, order_items(*))')
                    .eq('id', identifier)
                    .maybeSingle();

                if (pError || !paymentRecord) {
                    throw new Error(`Payment not found or fetch error: ${pError?.message}`);
                }
                payment = paymentRecord;
                order = paymentRecord.orders;
            } else {
                const { data: orderRecord, error: oError } = await supabase
                    .from('orders')
                    .select('*, payments!order_id(*), order_items(*)')
                    .eq('id', identifier)
                    .maybeSingle();

                if (oError || !orderRecord) {
                    throw new Error(`Order not found or fetch error: ${oError?.message}`);
                }
                order = orderRecord;
                payment = Array.isArray(orderRecord.payments) ? orderRecord.payments[0] : orderRecord.payments;
            }

            if (!payment || !payment.razorpay_payment_id) {
                throw new Error(`Razorpay payment ID not found for identifier: ${identifier}`);
            }

            // 2. Calculate Refund Amount
            let calculation;
            if (overrideAmount !== null) {
                calculation = {
                    amount: Number(overrideAmount),
                    excludedCharge: 0,
                    excludedGst: 0,
                    isFullRefund: false
                };
            } else if (refundType === REFUND_TYPES.TECHNICAL_REFUND && !order) {
                calculation = {
                    amount: Number(payment.amount),
                    excludedCharge: 0,
                    excludedGst: 0,
                    isFullRefund: true
                };
            } else if (order) {
                calculation = this.calculateRefundAmount(order, refundType, order.order_items);
            } else {
                throw new Error('Order data required for non-technical or existing-order refunds');
            }

            if (calculation.amount <= 0) {
                logger.warn(`[RefundService] Calculated refund amount is 0 or less. Skipping Razorpay call.`);
                return { success: false, reason: 'Zero refund amount' };
            }

            // 3. Initiate Razorpay Refund
            logger.info(`[RefundService] Initiating Razorpay refund: ${calculation.amount} for Payment: ${payment.razorpay_payment_id}`);

            const refundOptions = {
                amount: Math.round(calculation.amount * 100), // Razorpay expects paise
                speed: 'normal',
                notes: {
                    order_id: order?.id || 'N/A',
                    refund_type: refundType,
                    initiated_by: initiatedBy,
                    reason: reason,
                    db_payment_id: payment.id // Link back to internal payment
                }
            };

            const rpRefund = await razorpay.payments.refund(payment.razorpay_payment_id, refundOptions);
            logger.info(`[RefundService] Razorpay refund successful ID: ${rpRefund.id}`);

            // 4. Create Refund Record in DB (Source of Truth for refund type)
            // Using the updated 'refunds' table from schema migration
            const { error: refundDbError } = await supabase
                .from('refunds')
                .insert({
                    order_id: order?.id || null,
                    payment_id: payment.id,
                    razorpay_refund_id: rpRefund.id,
                    amount: calculation.amount,
                    status: 'processing', // Initial status, will be updated by webhook
                    razorpay_refund_status: 'PENDING',
                    refund_type: refundType,
                    reason: reason,
                    created_at: new Date().toISOString()
                });

            if (refundDbError) {
                logger.error(`[RefundService] Failed to insert into refunds table: ${refundDbError.message}`);
                // Critical: We continue because RP refund happened, but we log strictly.
            }

            // 5. Update Statuses (Initial optimistic update)
            // The Webhook will facilitate the final transition to REFUND_PARTIAL / REFUND_COMPLETED
            if (order) {
                await supabase
                    .from('orders')
                    .update({
                        payment_status: 'refund_initiated',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id);

                // Log Timeline
                try {
                    await logStatusHistory(
                        order.id,
                        'refund_initiated',
                        initiatedBy === 'USER' ? order.user_id : (initiatedBy === 'ADMIN' ? 'ADMIN' : 'SYSTEM'),
                        `Refund initiated for ₹${calculation.amount}. Reason: ${reason}`,
                        initiatedBy
                    );
                } catch (histError) {
                    logger.warn(`[RefundService] Failed to log history: ${histError.message}`);
                }
            }

            await supabase
                .from('payments')
                .update({
                    status: 'refund_initiated', // Interim status
                    refund_type: refundType,    // Lock the type on payment record
                    updated_at: new Date().toISOString()
                })
                .eq('id', payment.id);

            return {
                success: true,
                id: rpRefund.id,
                refundId: rpRefund.id,
                amount: calculation.amount
            };

        } catch (error) {
            logger.error(`[RefundService] Refund failed for identifier ${identifier}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = {
    RefundService,
    REFUND_TYPES
};
