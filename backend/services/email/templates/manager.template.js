/**
 * Manager-related Email Templates
 */
const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');

/**
 * Welcome email for newly created managers
 */
function getManagerWelcomeEmail({ name, email, password }) {
    const firstName = name ? name.split(' ')[0] : 'there';

    const content = `
        <h2>Welcome to the ${APP_NAME} Team!</h2>
        <p>Hi ${firstName},</p>
        <p>You have been added as a manager to the <strong>${APP_NAME}</strong> administrative portal.</p>
        
        <div class="info-box">
            <strong>Your Login Credentials:</strong><br>
            📧 Email: ${email}<br>
            🔑 Temporary Password: <code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${password}</code>
        </div>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/admin" class="button">Access Admin Portal</a>
        </p>
        
        <div class="warning-box">
            <strong>Action Required:</strong> For security reasons, you will be prompted to change your password upon your first login.
        </div>
        
        <p>If you have any trouble logging in, please contact the system administrator.</p>
        <p class="text-muted">Best regards,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Welcome to the ${APP_NAME} Manager Portal`,
        html: wrapInTemplate(content, { title: 'Manager Account Created' })
    };
}

module.exports = {
    getManagerWelcomeEmail
};
