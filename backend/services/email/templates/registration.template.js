/**
 * Registration Email Templates
 */
const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');

/**
 * Welcome email for new user registration
 */
function getRegistrationEmail({ name, email }) {
    const firstName = name ? name.split(' ')[0] : 'there';

    const content = `
        <h2>Welcome to ${APP_NAME}! 🎉</h2>
        <p>Hi ${firstName},</p>
        <p>We're thrilled to have you join our community. Your account has been successfully created.</p>
        
        <div class="info-box">
            <strong>Your Account Details:</strong><br>
            📧 Email: ${email}<br>
            📅 Joined: ${new Date().toLocaleDateString()}
        </div>
        
        <h3>What's Next?</h3>
        <ul style="color: #555;">
            <li>Browse our latest products</li>
            <li>Complete your profile</li>
            <li>Start shopping!</li>
        </ul>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}" class="button">Start Exploring</a>
        </p>
        
        <p>If you have any questions, our support team is always here to help.</p>
        <p class="text-muted">Welcome aboard!<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Welcome to ${APP_NAME}! 🎉`,
        html: wrapInTemplate(content, { title: `Welcome to ${APP_NAME}` })
    };
}

/**
 * Email verification (if needed separately)
 */
function getEmailVerificationEmail({ name, verificationLink }) {
    const firstName = name ? name.split(' ')[0] : 'there';

    const content = `
        <h2>Verify Your Email Address</h2>
        <p>Hi ${firstName},</p>
        <p>Please click the button below to verify your email address:</p>
        
        <p style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email</a>
        </p>
        
        <p class="text-muted">Or copy and paste this link:</p>
        <p style="word-break: break-all; font-size: 12px; color: #667eea;">
            ${verificationLink}
        </p>
        
        <p class="text-muted">This link will expire in 24 hours.</p>
    `;

    return {
        subject: `Verify your email - ${APP_NAME}`,
        html: wrapInTemplate(content)
    };
}

module.exports = {
    getRegistrationEmail,
    getEmailVerificationEmail
};

/**
 * Email confirmation for signup verification (with link)
 */
function getEmailConfirmationEmail({ name, email, verificationLink }) {
    const firstName = name ? name.split(' ')[0] : 'there';

    const content = `
        <h2>Confirm Your Email Address</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for signing up! Please confirm your email address to activate your account.</p>
        
        <p style="text-align: center;">
            <a href="${verificationLink}" class="button">Confirm My Email</a>
        </p>
        
        <p class="text-muted">Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; font-size: 12px; color: #667eea; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${verificationLink}
        </p>
        
        <div class="warning-box">
            <strong>Important:</strong> This link will expire in 24 hours.
            If you didn't create an account, please ignore this email.
        </div>
        
        <p class="text-muted">Thanks,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Confirm your email - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Email Confirmation' })
    };
}

// Re-export all functions
module.exports = {
    getRegistrationEmail,
    getEmailVerificationEmail,
    getEmailConfirmationEmail
};
