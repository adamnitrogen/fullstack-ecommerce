/**
 * Background Job Scheduler
 * Runs periodic tasks for email retry and invoice generation
 * Uses node-cron for scheduling
 */

const cron = require('node-cron');
const { EmailRetryService } = require('../services/email-retry.service');
const { InvoiceOrchestrator } = require('../services/invoice-orchestrator.service');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('Scheduler');

// Schedule configuration
const SCHEDULES = {
    // Email retry: Every 5 minutes
    EMAIL_RETRY: '*/5 * * * *',
    // Invoice retry: Every 15 minutes
    INVOICE_RETRY: '*/15 * * * *',
    // Cleanup old logs: Daily at 3 AM
    CLEANUP: '0 3 * * *'
};

let scheduledJobs = [];

/**
 * Initialize and start all scheduled jobs
 */
function initScheduler() {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
        log.info('SCHEDULER_SKIP', 'Scheduler disabled in test environment');
        return;
    }

    log.info('SCHEDULER_INIT', 'Initializing background job scheduler');

    // Email Retry Job
    const emailJob = cron.schedule(SCHEDULES.EMAIL_RETRY, async () => {
        log.debug('JOB_START', 'Email retry job started');
        try {
            const result = await EmailRetryService.processRetryQueue();
            if (result.processed > 0) {
                log.info('EMAIL_RETRY_COMPLETE', `Processed ${result.processed} emails`, {
                    successful: result.successful,
                    failed: result.failed
                });
            }
        } catch (error) {
            log.warn('EMAIL_RETRY_ERROR', 'Email retry job failed', { error: error.message });
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(emailJob);

    // Invoice Retry Job
    const invoiceJob = cron.schedule(SCHEDULES.INVOICE_RETRY, async () => {
        log.debug('JOB_START', 'Invoice retry job started');
        try {
            const result = await InvoiceOrchestrator.retryFailedInvoices();
            if (result.processed > 0) {
                log.info('INVOICE_RETRY_COMPLETE', `Processed ${result.processed} invoices`, {
                    successful: result.successful
                });
            }
        } catch (error) {
            log.warn('INVOICE_RETRY_ERROR', 'Invoice retry job failed', { error: error.message });
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
    scheduledJobs.push(invoiceJob);

    log.info('SCHEDULER_STARTED', 'All scheduled jobs initialized', {
        emailRetry: SCHEDULES.EMAIL_RETRY,
        invoiceRetry: SCHEDULES.INVOICE_RETRY
    });
}

/**
 * Stop all scheduled jobs (for graceful shutdown)
 */
function stopScheduler() {
    log.info('SCHEDULER_STOP', 'Stopping all scheduled jobs');
    scheduledJobs.forEach(job => job.stop());
    scheduledJobs = [];
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
    return {
        running: scheduledJobs.length > 0,
        jobs: scheduledJobs.map((job, index) => ({
            index,
            running: job.running
        })),
        schedules: SCHEDULES
    };
}

module.exports = {
    initScheduler,
    stopScheduler,
    getSchedulerStatus,
    SCHEDULES
};
