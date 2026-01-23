/**
 * Cron Routes
 * Endpoints for scheduled background jobs (called by external scheduler or cron service)
 */

const express = require('express');
const router = express.Router();
const EmailRetryService = require('../services/email-retry.service');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');
const { getSchedulerStatus } = require('../lib/scheduler');
const { optionalAuth } = require('../middleware/auth.middleware');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('CronRoutes');

// Simple auth middleware for cron endpoints
// Allows access if:
// 1. Valid CRON_SECRET is provided (via header or query)
// 2. OR User is authenticated as admin/manager (via session)
const cronAuth = (req, res, next) => {
    // 1. Check for Admin/Manager session first (from optionalAuth)
    if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
        return next();
    }

    // 2. Fallback to Cron Secret check
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = req.headers['x-cron-secret'] || req.query.secret;

    // In development, allow without secret if no user session
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    if (!cronSecret) {
        log.warn('CRON_SECRET_MISSING', 'CRON_SECRET not configured');
        return res.status(401).json({ error: 'Cron secret not configured' });
    }

    if (providedSecret !== cronSecret) {
        log.warn('CRON_AUTH_FAILED', 'Invalid cron secret provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

// Use optionalAuth for all routes to identify user if session exists
router.use((req, res, next) => {
    if (req.path === '/health') return next();
    optionalAuth(req, res, next);
});

/**
 * @route POST /api/cron/email-retry
 * @description Process failed email retry queue
 * @access Cron Secret
 */
router.post('/email-retry', cronAuth, async (req, res) => {
    log.info('CRON_EMAIL_RETRY', 'Email retry job triggered');

    try {
        const result = await EmailRetryService.processRetryQueue();

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        log.operationError('CRON_EMAIL_RETRY', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/cron/invoice-retry
 * @description Retry failed invoice generation
 * @access Cron Secret
 */
router.post('/invoice-retry', cronAuth, async (req, res) => {
    log.info('CRON_INVOICE_RETRY', 'Invoice retry job triggered');

    try {
        const result = await InvoiceOrchestrator.retryFailedInvoices();

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        log.operationError('CRON_INVOICE_RETRY', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/cron/email-stats
 * @description Get email retry statistics
 * @access Cron Secret
 */
router.get('/email-stats', cronAuth, async (req, res) => {
    try {
        const stats = await EmailRetryService.getRetryStats();
        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/cron/invoice-stats
 * @description Get invoice generation statistics
 * @access Cron Secret
 */
router.get('/invoice-stats', cronAuth, async (req, res) => {
    try {
        const stats = await InvoiceOrchestrator.getInvoiceStats();
        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/cron/scheduler-status
 * @description Get background job scheduler status
 * @access Cron Secret
 */
router.get('/scheduler-status', cronAuth, async (req, res) => {
    try {
        const status = getSchedulerStatus();
        res.status(200).json({
            success: true,
            ...status
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/cron/health
 * @description Health check for cron service
 * @access Public
 */
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'cron' });
});

module.exports = router;
