/**
 * Auth-related Email Templates (OTP, Password Reset)
 */
const { wrapInTemplate, APP_NAME } = require('./base.template');

/**
 * OTP verification email
 */
function getOTPEmail({ otp, expiryMinutes }) {
    const content = `
        <div style="text-align: center;">
            <h2>Your Verification Code</h2>
            <p>Use the following code to complete your sign-in. This code is valid for <strong>${expiryMinutes} minutes</strong>.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; margin: 30px auto; width: fit-content; border-radius: 8px; border: 1px dashed #667eea;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #667eea;">${otp}</span>
            </div>
            
            <p class="text-muted">If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
        </div>
    `;

    return {
        subject: `${otp} is your verification code - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Security Verification' })
    };
}

/**
 * Password reset email
 */
function getPasswordResetEmail({ resetLink }) {
    const content = `
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to choose a new one:</p>
        
        <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
        </p>
        
        <p class="text-muted">Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; font-size: 12px; color: #667eea; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${resetLink}
        </p>
        
        <div class="warning-box">
            <strong>Security Note:</strong> This link will expire in 1 hour.
            If you didn't request a password reset, please secure your account or contact us.
        </div>
    `;

    return {
        subject: `Reset your password - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: 'Password Reset' })
    };
}

module.exports = {
    getOTPEmail,
    getPasswordResetEmail
};
