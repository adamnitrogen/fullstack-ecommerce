/**
 * Email Service
 * Provider-agnostic email service with template support
 * 
 * Usage:
 *   const emailService = require('./services/email');
 *   await emailService.send(EmailEventTypes.USER_REGISTRATION, 'user@email.com', { name: 'John' });
 */

const supabase = require('../../config/supabase');
const { EmailEventTypes, DEPRECATED_EMAIL_TYPES } = require('./types');
const logger = require('../../utils/logger');
const emailConfig = require('../../config/email.config');

// Providers
const ConsoleProvider = require('./providers/console.provider');
const MailerSendProvider = require('./providers/mailersend.provider');
const SmtpProvider = require('./providers/smtp.provider');

// Templates
const { getRegistrationEmail, getEmailVerificationEmail, getEmailConfirmationEmail } = require('./templates/registration.template');
const { getOrderPlacedEmail, getOrderConfirmedEmail, getOrderShippedEmail, getOrderDeliveredEmail, getOrderCancellationEmail, getOrderReturnedEmail } = require('./templates/order.template');
const { getEventRegistrationEmail, getEventCancellationEmail, getEventUpdateEmail } = require('./templates/event.template');
const { getDonationReceiptEmail, getSubscriptionConfirmationEmail, getSubscriptionCancellationEmail } = require('./templates/donation.template');
const { getContactFormEmail, getContactAutoReplyEmail } = require('./templates/contact.template');
const { getAccountDeletedEmail, getAccountDeletionScheduledEmail, getAccountDeletionOTPEmail } = require('./templates/account.template');
const { getOTPEmail, getPasswordResetEmail } = require('./templates/auth.template');
const { getManagerWelcomeEmail } = require('./templates/manager.template');
// DEPRECATED Templates - Kept for backward compatibility but will not send emails
// const { getGSTInvoiceEmail } = require('./templates/gst-invoice.template');
// const { getRefundInitiatedEmail, getRefundCompletedEmail } = require('./templates/refund-status.template');
// const { getReturnRequestedEmail, getReturnApprovedEmail, getReturnRejectedEmail } = require('./templates/return-status.template');

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
                return getOrderPlacedEmail(data);

            case EmailEventTypes.ORDER_CONFIRMED:
                return getOrderConfirmedEmail(data);

            case EmailEventTypes.ORDER_SHIPPED:
                return getOrderShippedEmail(data);

            case EmailEventTypes.ORDER_DELIVERED:
                return getOrderDeliveredEmail(data);

            case EmailEventTypes.ORDER_RETURNED:
                return getOrderReturnedEmail(data);

            case EmailEventTypes.ORDER_CANCELLED:
                return getOrderCancellationEmail(data);

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

            case EmailEventTypes.ACCOUNT_DELETED:
                return getAccountDeletedEmail(data);

            case EmailEventTypes.ACCOUNT_DELETION_SCHEDULED:
                return getAccountDeletionScheduledEmail(data);

            case EmailEventTypes.ACCOUNT_DELETION_OTP:
                return getAccountDeletionOTPEmail(data);

            case EmailEventTypes.OTP_VERIFICATION:
                return getOTPEmail(data);

            case EmailEventTypes.PASSWORD_RESET:
                return getPasswordResetEmail(data);

            case EmailEventTypes.MANAGER_WELCOME:
                return getManagerWelcomeEmail(data);

            // DEPRECATED - These email types are no longer sent
            case EmailEventTypes.GST_INVOICE_GENERATED:
            case EmailEventTypes.REFUND_INITIATED:
            case EmailEventTypes.REFUND_COMPLETED:
            case EmailEventTypes.RETURN_REQUESTED:
            case EmailEventTypes.RETURN_APPROVED:
            case EmailEventTypes.RETURN_REJECTED:
            case EmailEventTypes.PAYMENT_CONFIRMED:
                throw new Error(`Email type ${eventType} is deprecated and will not be sent. Invoices and status updates are available via the order details page.`);

            default:
                throw new Error(`Unknown email event type: ${eventType}`);
        }
    }

    /**
     * Create email log entry (PENDING)
     */
    async _createLog({ to, eventType, subject, html, userId, referenceId, metadata }) {
        try {
            // Map unique internal types to existing DB enum values to avoid constraint errors
            const dbTypeMap = {
                'ORDER_PLACED': 'ORDER_CONFIRMATION',
                'ORDER_CONFIRMED': 'ORDER_STATUS_UPDATE',
                'ORDER_CANCELLED': 'ORDER_STATUS_UPDATE',
                'ORDER_RETURNED': 'ORDER_STATUS_UPDATE'
            };
            const dbEventType = dbTypeMap[eventType] || eventType;

            // Try RPC first (bypasses RLS if configured)
            const { data: logId, error } = await supabase.rpc('log_email_notification', {
                p_email_type: dbEventType,
                p_recipient_email: to,
                p_subject: subject,
                p_html_preview: html ? html.substring(0, 500) : '',
                p_user_id: userId,
                p_reference_id: referenceId,
                p_metadata: { ...metadata, internal_type: eventType }
            });

            if (!error && logId) return logId;

            // Fallback to direct insert if RPC fails (e.g. not found)
            if (error && error.code === '42883') {
                const dbTypeMap = {
                    'ORDER_PLACED': 'ORDER_CONFIRMATION',
                    'ORDER_CONFIRMED': 'ORDER_STATUS_UPDATE',
                    'ORDER_CANCELLED': 'ORDER_STATUS_UPDATE',
                    'ORDER_RETURNED': 'ORDER_STATUS_UPDATE'
                };
                const dbEventType = dbTypeMap[eventType] || eventType;

                logger.warn('[EmailService] RPC log_email_notification not found, falling back to direct insert');
                const { data } = await supabase.from('email_notifications').insert([{
                    user_id: userId,
                    email_type: dbEventType,
                    recipient_email: to,
                    reference_id: referenceId,
                    status: 'PENDING',
                    metadata: { ...metadata, subject, internal_type: eventType, html_preview: html ? html.substring(0, 500) : '' }
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

        // POLICY ENFORCEMENT: Block deprecated email types
        if (DEPRECATED_EMAIL_TYPES.includes(eventType)) {
            logger.warn({
                eventType,
                to,
                userId,
                referenceId
            }, '[EmailService] BLOCKED: Deprecated email type will not be sent');

            return {
                success: false,
                error: `Email type ${eventType} is deprecated and will not be sent. Information is available via the order details page.`,
                blocked: true
            };
        }

        logger.info({ eventType, to, userId, hasData: !!data }, '[EmailService] Internal send triggered');

        try {
            // Get template
            const templateResult = this._getTemplate(eventType, data);
            const { subject, html } = templateResult;
            logger.info({ eventType, to, subject }, '[EmailService] Template generated successfully');

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
     * Send order placed email (Pending)
     */
    async sendOrderPlacedEmail(to, { order, customerName, receiptUrl }, userId = null) {
        return this.send(EmailEventTypes.ORDER_PLACED, to, { order, customerName, receiptUrl }, { userId, referenceId: order.id });
    }

    /**
     * Send order confirmed email
     */
    async sendOrderConfirmedEmail(to, { order, customerName }, userId = null) {
        return this.send(EmailEventTypes.ORDER_CONFIRMED, to, { order, customerName }, { userId, referenceId: order.id });
    }

    /**
     * Send order shipped email
     */
    async sendOrderShippedEmail(to, { order, customerName }, userId = null) {
        return this.send(EmailEventTypes.ORDER_SHIPPED, to, { order, customerName }, { userId, referenceId: order.id });
    }

    /**
     * Send order delivered email
     */
    async sendOrderDeliveredEmail(to, { order, customerName, invoiceUrl }, userId = null) {
        return this.send(EmailEventTypes.ORDER_DELIVERED, to, { order, customerName, invoiceUrl }, { userId, referenceId: order.id });
    }

    /**
     * Send order returned email
     */
    async sendOrderReturnedEmail(to, { order, customerName }, userId = null) {
        return this.send(EmailEventTypes.ORDER_RETURNED, to, { order, customerName }, { userId, referenceId: order.id });
    }

    /**
     * Send order cancellation email
     */
    async sendOrderCancellationEmail(to, { order, customerName }, userId = null) {
        return this.send(EmailEventTypes.ORDER_CANCELLED, to, { order, customerName }, { userId, referenceId: order.id });
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

    /**
     * Send account deletion confirmation email
     */
    async sendAccountDeletedEmail(to, { name }, userId = null) {
        return this.send(EmailEventTypes.ACCOUNT_DELETED, to, { name }, { userId });
    }

    /**
     * Send account deletion scheduled email
     */
    async sendAccountDeletionScheduledEmail(to, { name, scheduledDate }, userId = null) {
        return this.send(EmailEventTypes.ACCOUNT_DELETION_SCHEDULED, to, { name, scheduledDate }, { userId });
    }

    /**
     * Send account deletion OTP email
     */
    async sendAccountDeletionOTPEmail(to, otp, expiryMinutes) {
        return this.send(EmailEventTypes.ACCOUNT_DELETION_OTP, to, { otp, expiryMinutes });
    }

    /**
     * Send OTP email
     */
    async sendOTPEmail(to, otp, expiryMinutes) {
        return this.send(EmailEventTypes.OTP_VERIFICATION, to, { otp, expiryMinutes });
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(to, resetLink) {
        return this.send(EmailEventTypes.PASSWORD_RESET, to, { resetLink });
    }

    /**
     * Send manager welcome email with temporary password
     */
    async sendManagerWelcomeEmail(to, name, password) {
        return this.send(EmailEventTypes.MANAGER_WELCOME, to, { name, email: to, password });
    }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;
module.exports.EmailService = EmailService;
module.exports.EmailEventTypes = EmailEventTypes;
