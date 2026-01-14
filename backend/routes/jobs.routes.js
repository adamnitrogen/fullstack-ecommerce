const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const supabase = require('../config/supabase');

/**
 * Admin Jobs Management Routes
 * All routes require admin/manager authentication
 */

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

/**
 * GET /api/admin/jobs
 * List all jobs with filters
 * Query params: type, status, page, limit
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type, status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build query - use simple select without FK reference to avoid constraint issues
        let query = supabase
            .from('account_deletion_jobs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        // Apply filters
        if (status) {
            query = query.eq('status', status.toUpperCase());
        }

        const { data: jobs, error, count } = await query;

        if (error) {
            logger.error({ err: error }, 'Supabase error fetching jobs');
            throw error;
        }

        // Fetch profile data separately if we have jobs
        let profileMap = {};
        if (jobs && jobs.length > 0) {
            const userIds = [...new Set(jobs.map(j => j.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, email, name')
                    .in('id', userIds);

                if (profiles) {
                    profileMap = profiles.reduce((acc, p) => {
                        acc[p.id] = p;
                        return acc;
                    }, {});
                }
            }
        }

        // Transform data for frontend
        const transformedJobs = (jobs || []).map(job => ({
            id: job.id,
            type: 'ACCOUNT_DELETION', // Currently only account deletion jobs
            status: job.status,
            mode: job.mode,
            userId: job.user_id,
            userEmail: profileMap[job.user_id]?.email || 'N/A',
            userName: profileMap[job.user_id]?.name || 'N/A',
            currentStep: job.current_step,
            stepsCompleted: job.steps_completed,
            errorLog: job.error_log,
            retryCount: job.retry_count,
            scheduledFor: job.scheduled_for,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            correlationId: job.correlation_id
        }));

        res.json({
            success: true,
            jobs: transformedJobs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / parseInt(limit))
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching jobs');
        res.status(500).json({ error: 'Failed to fetch jobs', details: error.message });
    }
});

/**
 * GET /api/admin/jobs/:id
 * Get single job details
 */
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: job, error } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Fetch profile separately
        let profile = null;
        if (job.user_id) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('email, name, phone')
                .eq('id', job.user_id)
                .single();
            profile = profileData;
        }

        res.json({
            success: true,
            job: {
                id: job.id,
                type: 'ACCOUNT_DELETION',
                status: job.status,
                mode: job.mode,
                userId: job.user_id,
                userEmail: profile?.email || 'N/A',
                userName: profile?.name || 'N/A',
                userPhone: profile?.phone || 'N/A',
                currentStep: job.current_step,
                stepsCompleted: job.steps_completed,
                errorLog: job.error_log,
                retryCount: job.retry_count,
                scheduledFor: job.scheduled_for,
                startedAt: job.started_at,
                completedAt: job.completed_at,
                createdAt: job.created_at,
                updatedAt: job.updated_at,
                correlationId: job.correlation_id
            }
        });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Error fetching job details');
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
});

/**
 * POST /api/admin/jobs/:id/retry
 * Retry a failed job
 */
router.post('/:id/retry', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const correlationId = req.correlationId;

        // Fetch job
        const { data: job, error: fetchError } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'FAILED' && job.status !== 'BLOCKED') {
            return res.status(400).json({
                error: `Cannot retry job with status ${job.status}. Only FAILED or BLOCKED jobs can be retried.`
            });
        }

        // Reset job to PENDING
        const { error: updateError } = await supabase
            .from('account_deletion_jobs')
            .update({
                status: 'PENDING',
                current_step: 'LOCK_USER',
                error_log: [...(job.error_log || []), {
                    message: `Manual retry by admin`,
                    adminId: req.user.id,
                    timestamp: new Date().toISOString()
                }],
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // Ensure profile is in correct state
        await supabase
            .from('profiles')
            .update({ deletion_status: 'DELETION_IN_PROGRESS' })
            .eq('id', job.user_id);

        // Trigger async processing
        const { DeletionJobProcessor } = require('../services/deletion-job-processor');
        setImmediate(async () => {
            try {
                await DeletionJobProcessor.processJob(id);
            } catch (err) {
                logger.error({ err, jobId: id }, '[AdminJobRetry] Job processing failed');
            }
        });

        logger.info({ jobId: id, correlationId, adminId: req.user.id }, '[AdminJobRetry] Job retry triggered');

        res.json({
            success: true,
            message: 'Job retry triggered successfully. Monitor status for completion.',
            jobId: id
        });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Error retrying job');
        res.status(500).json({ error: 'Failed to retry job' });
    }
});

/**
 * POST /api/admin/jobs/:id/process
 * Manually trigger processing of a PENDING job
 */
router.post('/:id/process', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const correlationId = req.correlationId;

        // Fetch job
        const { data: job, error: fetchError } = await supabase
            .from('account_deletion_jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (job.status !== 'PENDING') {
            return res.status(400).json({
                error: `Cannot process job with status ${job.status}. Only PENDING jobs can be processed.`
            });
        }

        // Ensure profile is in correct state
        await supabase
            .from('profiles')
            .update({ deletion_status: 'DELETION_IN_PROGRESS' })
            .eq('id', job.user_id);

        // Trigger async processing
        const { DeletionJobProcessor } = require('../services/deletion-job-processor');
        setImmediate(async () => {
            try {
                await DeletionJobProcessor.processJob(id);
            } catch (err) {
                logger.error({ err, jobId: id }, '[AdminJobProcess] Job processing failed');
            }
        });

        logger.info({ jobId: id, correlationId, adminId: req.user.id }, '[AdminJobProcess] Manual job processing triggered');

        res.json({
            success: true,
            message: 'Job processing triggered. Monitor status for completion.',
            jobId: id
        });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Error processing job');
        res.status(500).json({ error: 'Failed to process job' });
    }
});

module.exports = router;

