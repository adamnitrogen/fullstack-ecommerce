/**
 * Email Service
 * Provider-agnostic email service with template support
 * 
 * Usage:
 *   const emailService = require('./services/email');
 *   await emailService.send(EmailEventTypes.USER_REGISTRATION, 'user@email.com', { name: 'John' });
 */

const supabase = require('../../config/supabase');
const { EmailEventTypes } = require('./types');
const logger = require('../../utils/logger');
const emailConfig = require('../../config/email.config');

// Providers
const ConsoleProvider = require('./providers/console.provider');
const MailerSendProvider = require('./providers/mailersend.provider');
const SmtpProvider = require('./providers/smtp.provider');

// Templates
const { getRegistrationEmail, getEmailVerificationEmail, getEmailConfirmationEmail } = require('./templates/registration.template');
const { getOrderConfirmationEmail, getOrderStatusUpdateEmail } = require('./templates/order.template');
const { getEventRegistrationEmail, getEventCancellationEmail, getEventUpdateEmail } = require('./templates/event.template');
const { getDonationReceiptEmail, getSubscriptionConfirmationEmail, getSubscriptionCancellationEmail } = require('./templates/donation.template');
const { getContactFormEmail, getContactAutoReplyEmail } = require('./templates/contact.template');

class EmailService {
    constructor() {
        this.provider = this._initializeProvider();
        logger.info({ provider: this.provider.name }, 'EmailService initialized');
    }

    /**
     * Initialize the email provider based on environment configuration
     */
    _initializeProvider() {
        const providerName = emailConfig.getActiveProvider();

        // Validate configuration at startup
        emailConfig.validateActiveProvider();

        switch (providerName) {
            case 'mailersend':
                const mailersendProvider = new MailerSendProvider();
                if (mailersendProvider.isConfigured()) {
                    return mailersendProvider;
                }
                logger.warn('[EmailService] MailerSend not configured, falling back to console');
                return new ConsoleProvider();

            case 'smtp':
                const smtpProvider = new SmtpProvider();
                if (smtpProvider.isConfigured()) {
                    return smtpProvider;
                }
                logger.warn('[EmailService] SMTP not configured, falling back to console');
                return new ConsoleProvider();

            case 'console':
            default:
                return new ConsoleProvider();
        }
    }

    /**
     * Get email template by event type
     */
    _getTemplate(eventType, data) {
        switch (eventType) {
            case EmailEventTypes.USER_REGISTRATION:
                return getRegistrationEmail(data);

            case EmailEventTypes.ORDER_PLACED:
                return getOrderConfirmationEmail(data);

            case EmailEventTypes.ORDER_STATUS_UPDATE:
            case EmailEventTypes.ORDER_SHIPPED:
            case EmailEventTypes.ORDER_DELIVERED:
                return getOrderStatusUpdateEmail(data);

            case EmailEventTypes.EVENT_REGISTRATION:
                return getEventRegistrationEmail(data);

            case EmailEventTypes.EVENT_CANCELLATION:
                return getEventCancellationEmail(data);

            case EmailEventTypes.EVENT_UPDATE:
                return getEventUpdateEmail(data);

            case EmailEventTypes.DONATION_RECEIPT:
                return getDonationReceiptEmail(data);

            case EmailEventTypes.SUBSCRIPTION_STARTED:
                return getSubscriptionConfirmationEmail(data);

            case EmailEventTypes.SUBSCRIPTION_CANCELLED:
                return getSubscriptionCancellationEmail(data);

            case EmailEventTypes.CONTACT_FORM:
                return getContactFormEmail(data);

            case EmailEventTypes.EMAIL_CONFIRMATION:
                return getEmailConfirmationEmail(data);

            default:
                throw new Error(`Unknown email event type: ${eventType}`);
        }
    }

    /**
     * Create email log entry (PENDING)
     */
    async _createLog({ to, eventType, subject, html, userId, referenceId, metadata }) {
        try {
            // Try RPC first (bypasses RLS if configured)
            const { data: logId, error } = await supabase.rpc('log_email_notification', {
                p_email_type: eventType,
                p_recipient_email: to,
                p_subject: subject,
                p_html_preview: html ? html.substring(0, 500) : '',
                p_user_id: userId,
                p_reference_id: referenceId,
                p_metadata: metadata
            });

            if (!error && logId) return logId;

            // Fallback to direct insert if RPC fails (e.g. not found)
            if (error && error.code === '42883') {
                logger.warn('[EmailService] RPC log_email_notification not found, falling back to direct insert');
                const { data } = await supabase.from('email_notifications').insert([{
                    user_id: userId,
                    email_type: eventType,
                    recipient_email: to,
                    reference_id: referenceId,
                    status: 'PENDING',
                    metadata: { ...metadata, subject, html_preview: html ? html.substring(0, 500) : '' }
                }]).select('id').single();
                return data?.id;
            }

            if (error) {
                logger.error({ err: error }, '[EmailService] Failed to create log via RPC');
            }
            return null;
        } catch (err) {
            logger.error({ err: err.message }, '[EmailService] Failed to create email log');
            return null;
        }
    }

    /**
     * Update log status
     */
    async _updateLog(logId, updates) {
        if (!logId) return;
        try {
            await supabase.from('email_notifications').update({
                ...updates,
                updated_at: new Date().toISOString()
            }).eq('id', logId);
        } catch (err) {
            logger.error({ err: err.message, logId }, '[EmailService] Failed to update email log');
        }
    }

    /**
     * Send an email
     * @param {string} eventType - EmailEventTypes enum value
     * @param {string} to - Recipient email address
     * @param {Object} data - Template data
     * @param {Object} options - Additional options (userId, referenceId)
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async send(eventType, to, data, options = {}) {
        const { userId = null, referenceId = null } = options;
        let logId = null;

        try {
            // Get template
            const { subject, html } = this._getTemplate(eventType, data);

            // 1. Create Log (PENDING)
            logId = await this._createLog({
                to,
                eventType,
                subject,
                html,
                userId,
                referenceId,
                metadata: { provider: this.provider.name }
            });

            logger.info({
                eventType,
                to,
                referenceId,
                subject,
                provider: this.provider.name,
                logId
            }, 'Sending email');

            // 2. Send via provider
            const result = await this.provider.send({
                to,
                subject,
                html
            });

            // 3. Update Log
            if (logId) {
                await this._updateLog(logId, {
                    status: result.success ? 'SENT' : 'FAILED',
                    sent_at: result.success ? new Date().toISOString() : null,
                    error_message: result.error || null,
                    metadata: {
                        provider: this.provider.name,
                        messageId: result.messageId,
                        subject
                    }
                });
            }

            if (!result.success) {
                logger.error({
                    eventType,
                    to,
                    subject,
                    error: result.error,
                    provider: this.provider.name
                }, 'Email send failed');
            } else {
                logger.info({
                    eventType,
                    to,
                    subject,
                    messageId: result.messageId,
                    provider: this.provider.name
                }, 'Email sent successfully');
            }

            return result;

        } catch (error) {
            logger.error({
                eventType,
                to,
                err: error.message,
                provider: this.provider.name
            }, 'Email send error');

            // Update log failure
            if (logId) {
                await this._updateLog(logId, {
                    status: 'FAILED',
                    error_message: error.message
                });
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send registration/welcome email
     */
    async sendRegistrationEmail(to, { name, email }) {
        return this.send(EmailEventTypes.USER_REGISTRATION, to, { name, email });
    }

    /**
     * Send order confirmation email
     */
    async sendOrderConfirmationEmail(to, { order, customerName }, userId = null) {
        return this.send(EmailEventTypes.ORDER_PLACED, to, { order, customerName }, { userId, referenceId: order.id });
    }

    /**
     * Send order status update email
     */
    async sendOrderStatusUpdateEmail(to, { order, customerName, newStatus }, userId = null) {
        return this.send(EmailEventTypes.ORDER_STATUS_UPDATE, to, { order, customerName, newStatus }, { userId, referenceId: order.id });
    }

    /**
     * Send event registration email
     */
    async sendEventRegistrationEmail(to, { event, registration, attendeeName, isPaid = false, paymentDetails = null }, userId = null) {
        return this.send(EmailEventTypes.EVENT_REGISTRATION, to, { event, registration, attendeeName, isPaid, paymentDetails }, { userId, referenceId: registration.id });
    }

    /**
     * Send event cancellation email
     */
    async sendEventCancellationEmail(to, { event, registration, attendeeName, refundDetails = null }, userId = null) {
        return this.send(EmailEventTypes.EVENT_CANCELLATION, to, { event, registration, attendeeName, refundDetails }, { userId, referenceId: registration.id });
    }

    /**
     * Send event schedule update email
     */
    async sendEventUpdateEmail(to, { event, attendeeName }, userId = null) {
        return this.send(EmailEventTypes.EVENT_UPDATE, to, { event, attendeeName }, { userId, referenceId: event.id });
    }

    /**
     * Send donation receipt email
     */
    async sendDonationReceiptEmail(to, { donation, donorName, isAnonymous = false }, userId = null) {
        return this.send(EmailEventTypes.DONATION_RECEIPT, to, { donation, donorName, isAnonymous }, { userId, referenceId: donation.id });
    }

    /**
     * Send contact form notification to admin
     */
    async sendContactFormEmail(adminEmail, { name, email, phone, subject, message }) {
        return this.send(EmailEventTypes.CONTACT_FORM, adminEmail, { name, email, phone, subject, message });
    }

    /**
     * Send email confirmation with verification link
     */
    async sendEmailConfirmation(to, { name, email, verificationLink }, userId = null) {
        return this.send(EmailEventTypes.EMAIL_CONFIRMATION, to, { name, email, verificationLink }, { userId });
    }

    /**
     * Send subscription/monthly donation confirmation email
     */
    async sendSubscriptionConfirmationEmail(to, { subscription, donorName, isAnonymous = false }, userId = null) {
        return this.send(EmailEventTypes.SUBSCRIPTION_STARTED, to, { subscription, donorName, isAnonymous }, { userId, referenceId: subscription.donationRef });
    }

    /**
     * Send subscription cancellation email
     */
    async sendSubscriptionCancellationEmail(to, { subscription, donorName }, userId = null) {
        return this.send(EmailEventTypes.SUBSCRIPTION_CANCELLED, to, { subscription, donorName }, { userId, referenceId: subscription.donationRef });
    }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;
module.exports.EmailService = EmailService;
module.exports.EmailEventTypes = EmailEventTypes;
