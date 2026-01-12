/**
 * Contact Form Email Templates
 */
const { wrapInTemplate, APP_NAME } = require('./base.template');

/**
 * Contact form submission - internal notification to admin
 */
function getContactFormEmail({ name, email, phone, subject, message }) {
    const content = `
        <h2>New Contact Form Submission</h2>
        <p>A new message has been received through the contact form.</p>
        
        <div class="info-box">
            <strong>Contact Details:</strong><br>
            👤 Name: ${name || 'Not provided'}<br>
            📧 Email: ${email}<br>
            📱 Phone: ${phone || 'Not provided'}<br>
            📅 Submitted: ${new Date().toLocaleString()}
        </div>
        
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <strong>Message:</strong>
            <p style="white-space: pre-wrap; margin-top: 10px;">${message}</p>
        </div>
        
        <p class="text-muted">
            Please respond to this inquiry at your earliest convenience.<br>
            Reply directly to: <a href="mailto:${email}">${email}</a>
        </p>
    `;

    return {
        subject: `[Contact Form] ${subject || 'New Message'} from ${name || email}`,
        html: wrapInTemplate(content, { title: 'Contact Form Submission' })
    };
}

/**
 * Auto-reply to contact form submitter
 */
function getContactAutoReplyEmail({ name }) {
    const firstName = name ? name.split(' ')[0] : 'there';

    const content = `
        <h2>We've Received Your Message!</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for contacting us. We've received your message and our team will review it shortly.</p>
        
        <div class="info-box">
            <strong>What happens next?</strong>
            <ul style="margin: 5px 0;">
                <li>Our team will review your message within 24-48 hours</li>
                <li>You'll receive a response at this email address</li>
                <li>For urgent matters, please call our support line</li>
            </ul>
        </div>
        
        <p>We appreciate your patience and look forward to helping you!</p>
        <p class="text-muted">Best regards,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `We've received your message - ${APP_NAME}`,
        html: wrapInTemplate(content)
    };
}

module.exports = {
    getContactFormEmail,
    getContactAutoReplyEmail
};
