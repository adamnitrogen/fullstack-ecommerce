const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const AccountDeletionService = require('../services/account-deletion.service');
const { DeletionJobProcessor } = require('../services/deletion-job-processor');
const supabase = require('../config/supabase');

/**
 * Account Deletion Routes
 * All routes require authentication
 */

/**
 * GET /api/account/delete/eligibility
 * Check if user is eligible for account deletion
 */
router.get('/eligibility', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const correlationId = req.correlationId;

        const result = await AccountDeletionService.checkEligibility(userId, correlationId);

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error checking deletion eligibility');
        res.status(500).json({ error: 'Failed to check eligibility' });
    }
});

/**
 * GET /api/account/delete/status
 * Get current deletion status for user
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const status = await AccountDeletionService.getDeletionStatus(userId);

        res.json(status);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error getting deletion status');
        res.status(500).json({ error: 'Failed to get deletion status' });
    }
});

/**
 * POST /api/account/delete/request-otp
 * Request OTP for account deletion
 */
router.post('/request-otp', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        const correlationId = req.correlationId;

        if (!email) {
            return res.status(400).json({ error: 'Email is required for verification' });
        }

        const lang = req.get('x-user-lang') || 'en';
        const result = await AccountDeletionService.requestDeletionOTP(userId, email, correlationId, lang);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error requesting deletion OTP');
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

/**
 * POST /api/account/delete/verify-otp
 * Verify OTP and get Deletion Authorization Token
 */
router.post('/verify-otp', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const email = req.user.email;
        const { otp, deviceFingerprint } = req.body;
        const correlationId = req.correlationId;

        if (!otp) {
            return res.status(400).json({ error: 'OTP is required' });
        }

        const result = await AccountDeletionService.verifyDeletionOTP(
            userId,
            email,
            otp,
            deviceFingerprint,
            correlationId
        );

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error verifying deletion OTP');
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

/**
 * POST /api/account/delete/confirm
 * Confirm immediate account deletion
 * Requires valid DAT (Deletion Authorization Token)
 */
router.post('/confirm', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { authorizationToken, reason } = req.body;
        const correlationId = req.correlationId;

        if (!authorizationToken) {
            return res.status(400).json({ error: 'Authorization token is required' });
        }

        const lang = req.get('x-user-lang') || 'en';
        const result = await AccountDeletionService.confirmImmediateDeletion(
            userId,
            authorizationToken,
            reason,
            correlationId,
            lang
        );

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        // Clear any session cookies
        res.clearCookie('refreshToken');

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error confirming deletion');
        res.status(500).json({ error: 'Failed to initiate account deletion' });
    }
});

/**
 * POST /api/account/delete/schedule
 * Schedule account deletion for future date
 * Requires valid DAT (Deletion Authorization Token)
 */
router.post('/schedule', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { authorizationToken, days, reason } = req.body;
        const correlationId = req.correlationId;

        if (!authorizationToken) {
            return res.status(400).json({ error: 'Authorization token is required' });
        }

        if (!days || ![7, 15, 30].includes(days)) {
            return res.status(400).json({ error: 'Invalid grace period. Choose 7, 15, or 30 days.' });
        }

        const lang = req.get('x-user-lang') || 'en';
        const result = await AccountDeletionService.scheduleDeletion(
            userId,
            authorizationToken,
            days,
            reason,
            correlationId,
            lang
        );

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                blockingReasons: result.blockingReasons
            });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error scheduling deletion');
        res.status(500).json({ error: 'Failed to schedule account deletion' });
    }
});

/**
 * POST /api/account/delete/cancel
 * Cancel scheduled account deletion
 */
router.post('/cancel', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const correlationId = req.correlationId;

        const result = await AccountDeletionService.cancelScheduledDeletion(userId, correlationId);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error cancelling deletion');
        res.status(500).json({ error: 'Failed to cancel scheduled deletion' });
    }
});

/**
 * POST /api/account/delete/admin/process-pending
 * Admin-only: Manually trigger processing of PENDING deletion jobs
 */
router.post('/admin/process-pending', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { jobId } = req.body;
        const correlationId = req.correlationId;

        if (!jobId) {
            // Process all pending jobs
            const result = await DeletionJobProcessor.processScheduledDeletions();
            return res.json({ success: true, message: 'Scheduled jobs processing triggered', ...result });
        }

        // Process specific job
        const { data: job, error: fetchError } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'PENDING') {
            return res.status(400).json({ error: `Job status is ${job.status}, not PENDING. Update status first.` });
        }


        // Trigger async processing
        setImmediate(async () => {
            try {
                await DeletionJobProcessor.processJob(jobId);
            } catch (err) {
                logger.error({ err, jobId }, '[AdminProcessPending] Job processing failed');
            }
        });

        logger.info({ jobId, correlationId, adminId: req.user.id }, '[AdminProcessPending] Manual job processing triggered');

        res.json({
            success: true,
            message: 'Job processing triggered. Check job status for completion.',
            jobId
        });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Error processing pending job');
        res.status(500).json({ error: 'Failed to process job' });
    }
});

module.exports = router;

