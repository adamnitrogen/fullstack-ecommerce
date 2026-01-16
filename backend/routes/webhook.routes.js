/**
 * Webhook Routes
 * Handles incoming webhooks from external payment providers
 */

const express = require('express');
const router = express.Router();
const { RazorpayWebhookLogger } = require('../services/razorpay-webhook-logger.service');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('WebhookRoutes');

/**
 * @route POST /api/webhooks/razorpay
 * @description Handle incoming Razorpay webhooks
 * @access Public (verified via signature)
 */
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const rawBody = req.body.toString();

        // Parse the event
        let event;
        try {
            event = JSON.parse(rawBody);
        } catch (parseError) {
            log.warn('WEBHOOK_PARSE_ERROR', 'Failed to parse webhook body');
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        log.info('WEBHOOK_RECEIVED', `Received Razorpay webhook: ${event.event}`, {
            eventType: event.event,
            hasSignature: !!signature
        });

        // Process the webhook
        const result = await RazorpayWebhookLogger.processWebhookEvent(
            event,
            rawBody,
            signature || ''
        );

        if (result.success) {
            res.status(200).json({ status: 'ok', verified: result.verified });
        } else {
            // Still return 200 to prevent Razorpay from retrying
            // We've logged the error for investigation
            res.status(200).json({ status: 'logged', error: result.error });
        }

    } catch (error) {
        log.operationError('WEBHOOK_HANDLER', error);
        // Return 200 to prevent retries - we've captured the error
        res.status(200).json({ status: 'error', message: 'Internal processing error' });
    }
});

const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

/**
 * @route GET /api/webhooks/logs
 * @description Get recent webhook logs (admin only)
 * @access Admin/Manager
 */
router.get('/logs', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        // Note: Add auth middleware for admin protection in production
        const limit = parseInt(req.query.limit) || 50;
        const logs = await RazorpayWebhookLogger.getRecentLogs(limit);

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch webhook logs' });
    }
});

module.exports = router;
