const Razorpay = require('razorpay');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

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
     */
    static calculateRefundAmount(order, refundType) {
        const totalAmount = Number(order.total_amount || order.totalAmount || 0);
        const deliveryCharge = Number(order.delivery_charge || 0);
        const deliveryGst = Number(order.delivery_gst || 0);
        const isDeliveryRefundable = order.is_delivery_refundable !== false; // Default true

        if (refundType === REFUND_TYPES.TECHNICAL_REFUND) {
            return {
                amount: totalAmount,
                excludedCharge: 0,
                excludedGst: 0,
                isFullRefund: true
            };
        }

        // BUSINESS_REFUND: Exclude delivery fees if policy says non-refundable
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
                // Fetch payment first
                const { data: paymentRecord, error: pError } = await supabase
                    .from('payments')
                    .select('*, orders(*)')
                    .eq('id', identifier)
                    .single();

                if (pError || !paymentRecord) {
                    throw new Error(`Payment not found or fetch error: ${pError?.message}`);
                }
                payment = paymentRecord;
                order = paymentRecord.orders;
            } else {
                const { data: orderRecord, error: oError } = await supabase
                    .from('orders')
                    .select('*, payments!order_id(*)')
                    .eq('id', identifier)
                    .single();

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
                // Special case for technical failure before order creation
                calculation = {
                    amount: Number(payment.amount),
                    excludedCharge: 0,
                    excludedGst: 0,
                    isFullRefund: true
                };
            } else if (order) {
                calculation = this.calculateRefundAmount(order, refundType);
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
                    reason: reason
                }
            };

            const rpRefund = await razorpay.payments.refund(payment.razorpay_payment_id, refundOptions);
            logger.info(`[RefundService] Razorpay refund successful ID: ${rpRefund.id}`);

            // 4. Log to Audit Table (Immutable record)
            const { error: auditError } = await supabase
                .from('refund_audit_logs')
                .insert({
                    order_id: order?.id || null, // Might be null for technical failures
                    payment_id: payment.razorpay_payment_id,
                    refund_type: refundType,
                    original_paid_amount: order?.total_amount || payment.amount,
                    delivery_charge_excluded: calculation.excludedCharge,
                    delivery_gst_excluded: calculation.excludedGst,
                    refunded_amount: calculation.amount,
                    razorpay_refund_id: rpRefund.id,
                    initiated_by: initiatedBy,
                    reason: reason
                });

            if (auditError) {
                logger.error(`[RefundService] Failed to create audit log: ${auditError.message}`);
            }

            // 5. Update Statuses
            if (order) {
                await supabase
                    .from('orders')
                    .update({
                        payment_status: calculation.isFullRefund ? 'refunded' : 'partially_refunded',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id);
            }

            await supabase
                .from('payments')
                .update({
                    status: calculation.isFullRefund ? 'refunded' : 'partially_refunded',
                    updated_at: new Date().toISOString()
                })
                .eq('id', payment.id);

            return {
                success: true,
                id: rpRefund.id, // Return ID for consistency with legacy RP calls
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
