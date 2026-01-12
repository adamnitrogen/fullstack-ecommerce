const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const nodemailer = require('nodemailer');
const emailConfig = require('../config/email.config');

const APP_NAME = process.env.APP_NAME || 'MeriGauMata';

/**
 * Email Service using Supabase
 * 
 * Note: Supabase Auth handles authentication emails (confirmation, password reset) automatically.
 * Configure SMTP settings in your Supabase Dashboard under Authentication > Email Templates.
 * 
 * For custom transactional emails (order confirmations, welcome emails, etc.),
 * this service logs them to the database. To actually send these emails,
 * configure a custom SMTP provider or MailerSend in your .env file.
 */

/**
 * Base email template wrapper
 */
function getEmailTemplate(content) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${APP_NAME}</title>
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .info-box { background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
        .warning-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .order-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header"><h1>${APP_NAME}</h1></div>
        <div class="content">${content}</div>
        <div class="footer"><p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p></div>
    </div>
</body>
</html>`;
}

/**
 * Helper to log mock email
 */
function performMockSend(to, subject, html) {
    logger.info('\n' + '='.repeat(50));
    logger.info('📧 [MOCK EMAIL SENT]');
    logger.info(`To: ${to}`);
    logger.info(`Subject: ${subject}`);

    // Try to extract OTP for convenience
    const otpMatch = html.match(/>\s*(\d{6})\s*</) || html.match(/(\d{6})/);
    if (otpMatch && (subject.includes('Verification') || subject.includes('OTP'))) {
        logger.info(`🔑 OTP CODE: ${otpMatch[1]}`);
    } else {
        // Clean HTML tags for a brief preview
        const textPreview = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100);
        logger.info(`Preview: ${textPreview}...`);
    }

    logger.info('='.repeat(50) + '\n');
    return { success: true, id: 'mock-' + Date.now() };
}

/**
 * Send email using SMTP (Nodemailer)
 */
async function sendSmtpEmail({ to, subject, html }) {
    if (!emailConfig.smtp.isConfigured()) {
        throw new Error('SMTP is not fully configured');
    }

    const transporter = nodemailer.createTransport(emailConfig.smtp.getTransportOptions());

    // Verify connection config
    await transporter.verify();

    const info = await transporter.sendMail({
        from: `"${emailConfig.smtp.from.name}" <${emailConfig.smtp.from.email}>`,
        to,
        subject,
        html
    });

    return { success: true, id: info.messageId };
}

/**
 * Send email using MailerSend API
 */
async function sendMailerSendEmail({ to, subject, html }) {
    if (!emailConfig.mailersend.isConfigured()) {
        throw new Error('MailerSend is not fully configured');
    }

    const response = await fetch(emailConfig.mailersend.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${emailConfig.mailersend.apiKey}`,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            from: {
                email: emailConfig.mailersend.from.email,
                name: emailConfig.mailersend.from.name
            },
            to: [
                {
                    email: to
                }
            ],
            subject: subject,
            html: html
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`MailerSend Error: ${JSON.stringify(errorData)}`);
    }

    // MailerSend returns 202 Accepted without a body usually, checking for response header
    const messageId = response.headers.get('x-message-id') || `mailersend-${Date.now()}`;
    return { success: true, id: messageId };
}

/**
 * Log email to database AND Send via active provider
 */
async function sendEmail({ to, subject, html, type, userId = null, referenceId = null, metadata = {} }) {
    logger.info(`[EmailService] Processing ${type} email for ${to}`);

    // 1. Log to database as PENDING
    let logId = null;
    const { data: logResult, error: logError } = await supabase.rpc('log_email_notification', {
        p_email_type: type,
        p_recipient_email: to,
        p_subject: subject,
        p_html_preview: html.substring(0, 500),
        p_user_id: userId,
        p_reference_id: referenceId,
        p_metadata: metadata
    });

    if (logError) {
        // Try fallback direct insert if RPC fails
        if (logError.code === '42883') {
            const { data: directLog } = await supabase.from('email_notifications').insert([{
                user_id: userId,
                email_type: type,
                recipient_email: to,
                reference_id: referenceId,
                status: 'PENDING',
                metadata: { ...metadata, subject, html_preview: html.substring(0, 500) }
            }]).select().single();
            logId = directLog?.id;
        } else {
            logger.error({ err: logError }, '[EmailService] Failed to log email (RPC):');
        }
    } else {
        logId = logResult;
    }

    // 2. Send Email via Active Provider
    let sendResult = { success: false, id: null };
    const provider = emailConfig.getActiveProvider();

    try {
        switch (provider) {
            case 'smtp':
                sendResult = await sendSmtpEmail({ to, subject, html });
                break;
            case 'mailersend':
                sendResult = await sendMailerSendEmail({ to, subject, html });
                break;
            case 'console':
            default:
                sendResult = performMockSend(to, subject, html);
                break;
        }

        // 3. Update Log Status to SENT
        if (logId) {
            await supabase.from('email_notifications')
                .update({
                    status: 'SENT',
                    sent_at: new Date().toISOString(),
                    metadata: { ...metadata, provider_id: sendResult.id, provider }
                })
                .eq('id', logId);
        }

        logger.info(`[EmailService] Email Sent - Type: ${type}, To: ${to}, ID: ${sendResult.id}, Provider: ${provider}`);
        return { success: true, id: logId, messageId: sendResult.id, method: provider };

    } catch (error) {
        logger.error({ err: error, provider }, '[EmailService] Failed to send email:');

        // Update Log Status to FAILED
        if (logId) {
            await supabase.from('email_notifications')
                .update({
                    status: 'FAILED',
                    error_message: error.message,
                    metadata: { ...metadata, provider }
                })
                .eq('id', logId);
        }

        return { success: false, error: error.message };
    }
}

/**
 * Specific Email Types
 */

// 1. Send OTP
async function sendOTPEmail(to, otp, expiryMinutes = 5) {
    const content = `
        <h2>Verify Your Email</h2>
        <p>Your verification code is:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">
            ${otp}
        </div>
        <p>This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>
        <p>If you didn't request this code, please ignore this email.</p>
    `;

    return sendEmail({
        to,
        subject: `Your Verification Code: ${otp}`,
        html: getEmailTemplate(content),
        type: 'OTP_VERIFICATION'
    });
}

// 2. Welcome Email
async function sendWelcomeEmail(to, name, userId = null) {
    const content = `
        <h2>Welcome to ${APP_NAME}!</h2>
        <p>Hi ${name || 'there'},</p>
        <p>We're thrilled to have you join our community. Your account has been successfully created.</p>
        <div class="info-box">
            <strong>What's Next?</strong>
            <ul>
                <li>Browse our latest products</li>
                <li>Complete your profile</li>
                <li>Start shopping!</li>
            </ul>
        </div>
        <a href="${process.env.FRONTEND_URL || 'https://merigaumata.com'}" class="button">Start Exploring</a>
        <p>If you have any questions, our support team is always here to help.</p>
    `;

    return sendEmail({
        to,
        subject: `Welcome to ${APP_NAME}!`,
        html: getEmailTemplate(content),
        type: 'REGISTRATION',
        userId
    });
}

// 3. Order Confirmation
async function sendOrderConfirmationEmail(to, order, userId = null) {
    const itemsHtml = order.items?.map(item => `
        <div class="order-item">
            <span>${item.name || item.title} x ${item.quantity}</span>
            <span>₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
        </div>
    `).join('') || '';

    const content = `
        <h2>Order Confirmed! 🎉</h2>
        <p>Thank you for your order. We've received your payment and are preparing your items.</p>
        <div class="info-box">
            <strong>Order Number:</strong> ${order.orderNumber || order.id}<br>
            <strong>Order Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString()}
        </div>
        <h3>Order Summary</h3>
        ${itemsHtml}
        <div style="margin-top: 20px; padding-top: 10px; border-top: 2px solid #333;">
            <strong>Total: ₹${(order.totalAmount || order.amount || 0).toFixed(2)}</strong>
        </div>
        <p>We'll send you another email when your order ships.</p>
    `;

    return sendEmail({
        to,
        subject: `Order Confirmed - ${order.orderNumber || order.id}`,
        html: getEmailTemplate(content),
        type: 'ORDER_CONFIRMATION',
        userId,
        referenceId: order.id,
        metadata: { orderNumber: order.orderNumber, amount: order.totalAmount }
    });
}

// 4. Event Registration Confirmation
async function sendEventRegistrationEmail(to, event, registration, userId = null) {
    const content = `
        <h2>You're Registered! 🎟️</h2>
        <p>Your registration for <strong>${event.title}</strong> has been confirmed.</p>
        <div class="info-box">
            <strong>Event Details:</strong><br>
            📅 Date: ${new Date(event.startDate || event.date).toLocaleDateString()}<br>
            📍 Location: ${event.location || 'TBA'}<br>
            🎫 Registration ID: ${registration.id}
        </div>
        ${event.description ? `<p>${event.description}</p>` : ''}
        <p>We look forward to seeing you there!</p>
    `;

    return sendEmail({
        to,
        subject: `Registration Confirmed - ${event.title}`,
        html: getEmailTemplate(content),
        type: 'EVENT_REGISTRATION',
        userId,
        referenceId: registration.id,
        metadata: { eventId: event.id, eventTitle: event.title }
    });
}

// 5. Donation Receipt
async function sendDonationReceiptEmail(to, donation, isAnonymous = false) {
    const content = `
        <h2>Thank You for Your Donation! 🙏</h2>
        <p>${isAnonymous ? 'Dear Donor' : `Hi ${donation.donor_name || 'Valued Donor'}`},</p>
        <p>We are deeply grateful for your generous contribution to our cause.</p>
        <div class="info-box">
            <strong>Donation Receipt</strong><br>
            💰 Amount: ₹${(donation.amount || 0).toFixed(2)}<br>
            📅 Date: ${new Date(donation.createdAt || Date.now()).toLocaleDateString()}<br>
            🧾 Receipt ID: ${donation.id}
        </div>
        <p>Your support makes a real difference. Thank you for being part of our mission.</p>
    `;

    return sendEmail({
        to,
        subject: 'Thank You for Your Donation!',
        html: getEmailTemplate(content),
        type: 'DONATION_RECEIPT',
        userId: isAnonymous ? null : donation.user_id,
        referenceId: donation.id,
        metadata: { amount: donation.amount, isAnonymous }
    });
}

// 6. Password Reset (Note: Supabase Auth handles this automatically)
async function sendPasswordResetEmail(to, resetLink) {
    // Note: This is typically handled by Supabase Auth automatically
    // This function is for logging/tracking purposes
    const content = `
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password.</p>
        <a href="${resetLink}" class="button">Reset Password</a>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
    `;

    return sendEmail({
        to,
        subject: 'Reset Your Password',
        html: getEmailTemplate(content),
        type: 'PASSWORD_RESET'
    });
}

// 7. Contact Form Internal Notification
async function sendContactNotification(message) {
    const content = `
        <h2>New Contact Message 📬</h2>
        <div class="info-box">
            <strong>Sender Details:</strong><br>
            👤 Name: ${message.name}<br>
            📧 Email: ${message.email}<br>
            📅 Date: ${new Date(message.created_at || Date.now()).toLocaleString()}<br>
            🆔 ID: ${message.id}
        </div>
        <h3>Message:</h3>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 10px 0;">
            ${message.message.replace(/\n/g, '<br>')}
        </div>
    `;

    // Send to support email defined in env or fallback to a default admin email
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || 'support@merigaumata.com';

    return sendEmail({
        to: supportEmail,
        subject: `[Contact Form] New Message from ${message.name}`,
        html: getEmailTemplate(content),
        type: 'CONTACT_NOTIFICATION',
        referenceId: message.id,
        metadata: { senderEmail: message.email, senderName: message.name }
    });
}

// 8. Contact Form Auto-Reply (Optional)
async function sendContactAutoReply(to, name) {
    if (process.env.AUTO_REPLY_ENABLED !== 'true') {
        return { success: true, skipped: true };
    }

    const teamName = "MeriGauMata Team";
    const content = `
        <h2>We received your message! 📨</h2>
        <p>Hi ${name},</p>
        <p>Thanks for reaching out to us. We have received your message and our team will get back to you as soon as possible.</p>
        <p>In the meantime, feel free to browse our <a href="${process.env.FRONTEND_URL}/faq">FAQs</a>.</p>
        <br>
        <p>Best regards,<br>${teamName}</p>
    `;

    return sendEmail({
        to,
        subject: `We received your message - MeriGauMata`,
        html: getEmailTemplate(content),
        type: 'CONTACT_AUTO_REPLY'
    });
}

// 9. Manager Welcome Email (with password)
async function sendManagerWelcomeEmail(to, name, password) {
    const content = `
        <h2>Welcome to the Team! 🤝</h2>
        <p>Hi ${name},</p>
        <p>You have been added as a manager to ${APP_NAME}.</p>
        <div class="info-box">
            <strong>Your Login Credentials:</strong><br>
            📧 Email: ${to}<br>
            🔑 Temporary Password: <strong>${password}</strong>
        </div>
        <div class="warning-box">
            <strong>Action Required:</strong> Please log in and change your password immediately.
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth" class="button">Log In Now</a>
    `;

    return sendEmail({
        to,
        subject: `Welcome to ${APP_NAME} - Manager Access`,
        html: getEmailTemplate(content),
        type: 'MANAGER_WELCOME'
    });
}

module.exports = {
    sendEmail,
    sendOTPEmail,
    sendWelcomeEmail,
    sendOrderConfirmationEmail,
    sendEventRegistrationEmail,
    sendDonationReceiptEmail,
    sendPasswordResetEmail,
    sendContactNotification,
    sendContactAutoReply,
    sendManagerWelcomeEmail,
    getEmailTemplate
};
