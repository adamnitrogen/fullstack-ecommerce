/**
 * Auth-related Email Templates (OTP, Password Reset)
 */
const { wrapInTemplate, APP_NAME } = require('./base.template');

/**
 * OTP verification email
 */
function getOTPEmail({ otp, expiryMinutes, lang = 'en' }) {
    const i18n = {
        en: {
            title: 'Your Verification Code',
            body: `Use the following code to complete your sign-in. This code is valid for <strong>${expiryMinutes} minutes</strong>.`,
            note: "If you didn't request this code, please ignore this email or contact support if you have concerns.",
            subject: 'is your verification code',
            secTitle: 'Security Verification'
        },
        hi: {
            title: 'आपका सत्यापन कोड',
            body: `अपने साइन-इन को पूरा करने के लिए निम्नलिखित कोड का उपयोग करें। यह कोड <strong>${expiryMinutes} मिनट</strong> के लिए मान्य है।`,
            note: 'यदि आपने इस कोड का अनुरोध नहीं किया है, तो कृपया इस ईमेल को अनदेखा करें या यदि आपको कोई चिंता है तो सहायता से संपर्क करें।',
            subject: 'आपका सत्यापन कोड है',
            secTitle: 'सुरक्षा सत्यापन'
        }
    };

    const strings = i18n[lang] || i18n.en;

    const content = `
        <div style="text-align: center;">
            <h2>${strings.title}</h2>
            <p>${strings.body}</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; margin: 30px auto; width: fit-content; border-radius: 8px; border: 1px dashed #667eea;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #667eea;">${otp}</span>
            </div>
            
            <p class="text-muted">${strings.note}</p>
        </div>
    `;

    return {
        subject: `${otp} ${strings.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: strings.secTitle, lang })
    };
}

/**
 * Password reset email
 */
function getPasswordResetEmail({ resetLink, lang = 'en' }) {
    const i18n = {
        en: {
            title: 'Reset Your Password',
            body: 'We received a request to reset your password. Click the button below to choose a new one:',
            button: 'Reset Password',
            copy: 'Or copy and paste this link in your browser:',
            note: '<strong>Security Note:</strong> This link will expire in 1 hour. If you didn\'t request a password reset, please secure your account or contact us.',
            subject: 'Reset your password',
            secTitle: 'Password Reset'
        },
        hi: {
            title: 'अपना पासवर्ड रीसेट करें',
            body: 'हमें आपका पासवर्ड रीसेट करने का अनुरोध प्राप्त हुआ है। नया पासवर्ड चुनने के लिए नीचे दिए गए बटन पर क्लिक करें:',
            button: 'पासवर्ड रीसेट करें',
            copy: 'या इस लिंक को अपने ब्राउज़र में कॉपी और पेस्ट करें:',
            note: '<strong>सुरक्षा नोट:</strong> यह लिंक 1 घंटे में समाप्त हो जाएगा। यदि आपने पासवर्ड रीसेट करने का अनुरोध नहीं किया है, तो कृपया अपना खाता सुरक्षित करें या हमसे संपर्क करें।',
            subject: 'अपना पासवर्ड रीसेट करें',
            secTitle: 'पासवर्ड रीसेट'
        }
    };

    const strings = i18n[lang] || i18n.en;

    const content = `
        <h2>${strings.title}</h2>
        <p>${strings.body}</p>
        
        <p style="text-align: center;">
            <a href="${resetLink}" class="button">${strings.button}</a>
        </p>
        
        <p class="text-muted">${strings.copy}</p>
        <p style="word-break: break-all; font-size: 12px; color: #667eea; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${resetLink}
        </p>
        
        <div class="warning-box">
            ${strings.note}
        </div>
    `;

    return {
        subject: `${strings.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: strings.secTitle, lang })
    };
}

module.exports = {
    getOTPEmail,
    getPasswordResetEmail
};
