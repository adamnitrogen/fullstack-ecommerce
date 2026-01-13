const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Refund Service
 * Handles refund state machine and lifecycle tracking
 */
class RefundService {
    /**
     * Create initial refund record
     */
    static async initiateRefund({ eventId, userId, registrationId, paymentId, amount, correlationId }) {
        logger.info({
            module: 'RefundService',
            operation: 'INITIATE',
            registrationId,
            paymentId,
            amount,
            correlationId
        }, 'Initiating refund record');

        const { data, error } = await supabase
            .from('event_refunds')
            .insert([{
                event_id: eventId,
                user_id: userId,
                registration_id: registrationId,
                payment_id: paymentId,
                amount: amount,
                status: 'INITIATED',
                initiated_at: new Date().toISOString(),
                correlation_id: correlationId
            }])
            .select()
            .single();

        if (error) {
            logger.error({ err: error, registrationId }, 'Failed to initiate refund record');
            throw error;
        }

        return data;
    }

    /**
     * Update refund status to PROCESSING
     */
    static async markProcessing(id, gatewayReference) {
        logger.info({ id, gatewayReference }, 'Marking refund as PROCESSING');

        const { data, error } = await supabase
            .from('event_refunds')
            .update({
                status: 'PROCESSING',
                gateway_reference: gatewayReference,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update refund status to SETTLED
     */
    static async markSettled(id, settledAt) {
        logger.info({ id, settledAt }, 'Marking refund as SETTLED');

        const { data, error } = await supabase
            .from('event_refunds')
            .update({
                status: 'SETTLED',
                settled_at: settledAt || new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update refund status to FAILED
     */
    static async markFailed(id, reason) {
        logger.warn({ id, reason }, 'Marking refund as FAILED');

        const { data, error } = await supabase
            .from('event_refunds')
            .update({
                status: 'FAILED',
                failed_at: new Date().toISOString(),
                failure_reason: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get refunds for an event
     */
    static async getRefundsByEvent(eventId) {
        const { data, error } = await supabase
            .from('event_refunds')
            .select('*')
            .eq('event_id', eventId);

        if (error) throw error;
        return data;
    }
}

module.exports = RefundService;
