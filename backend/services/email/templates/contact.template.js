const { wrapInTemplate, APP_NAME } = require('./base.template');
const { getCommonStrings } = require('./i18n');

/**
 * Contact form submission - internal notification to admin
 */
function getContactFormEmail({ name, email, phone, subject, message, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: 'New Contact Form Submission',
            desc: 'A new message has been received through the contact form.',
            detailsTitle: 'Contact Details:',
            name: 'Name',
            email: 'Email',
            phone: 'Phone',
            submitted: 'Submitted',
            subjectLabel: 'Subject',
            messageLabel: 'Message',
            respondPrompt: 'Please respond to this inquiry at your earliest convenience.',
            replyTo: 'Reply directly to:',
            templateTitle: 'Contact Form Submission'
        },
        hi: {
            title: 'नया संपर्क फ़ॉर्म सबमिशन',
            desc: 'संपर्क फ़ॉर्म के माध्यम से एक नया संदेश प्राप्त हुआ है।',
            detailsTitle: 'संपर्क विवरण:',
            name: 'नाम',
            email: 'ईमेल',
            phone: 'फ़ोन',
            submitted: 'जमा किया गया',
            subjectLabel: 'विषय',
            messageLabel: 'संदेश',
            respondPrompt: 'कृपया अपनी सुविधानुसार इस पूछताछ का उत्तर दें।',
            replyTo: 'सीधे उत्तर दें:',
            templateTitle: 'संपर्क फ़ॉर्म सबमिशन'
        }
    };

    const s = i18n[lang] || i18n.en;

    const content = `
        <h2>${s.title}</h2>
        <p>${s.desc}</p>
        
        <div class="info-box">
            <strong>${s.detailsTitle}</strong><br>
            👤 ${s.name}: ${name || (lang === 'hi' ? 'प्रदान नहीं किया गया' : 'Not provided')}<br>
            📧 ${s.email}: ${email}<br>
            📱 ${s.phone}: ${phone || (lang === 'hi' ? 'प्रदान नहीं किया गया' : 'Not provided')}<br>
            📅 ${s.submitted}: ${new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
        </div>
        
        ${subject ? `<p><strong>${s.subjectLabel}:</strong> ${subject}</p>` : ''}
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <strong>${s.messageLabel}:</strong>
            <p style="white-space: pre-wrap; margin-top: 10px;">${message}</p>
        </div>
        
        <p class="text-muted">
            ${s.respondPrompt}<br>
            ${s.replyTo} <a href="mailto:${email}">${email}</a>
        </p>
    `;

    return {
        subject: `[Contact Form] ${subject || (lang === 'hi' ? 'नया संदेश' : 'New Message')} from ${name || email}`,
        html: wrapInTemplate(content, { title: s.templateTitle, lang })
    };
}

/**
 * Auto-reply to contact form submitter
 */
function getContactAutoReplyEmail({ name, lang = 'en' }) {
    const common = getCommonStrings(lang);
    const i18n = {
        en: {
            title: "We've Received Your Message!",
            received: "Thank you for contacting us. We've received your message and our team will review it shortly.",
            nextSteps: 'What happens next?',
            step1: 'Our team will review your message within 24-48 hours',
            step2: "You'll receive a response at this email address",
            step3: 'For urgent matters, please call our support line',
            thanksPatience: 'We appreciate your patience and look forward to helping you!',
            subject: "We've received your message"
        },
        hi: {
            title: 'हमें आपका संदेश मिल गया है!',
            received: 'हमसे संपर्क करने के लिए धन्यवाद। हमें आपका संदेश मिल गया है और हमारी टीम जल्द ही इसकी समीक्षा करेगी।',
            nextSteps: 'आगे क्या होगा?',
            step1: 'हमारी टीम 24-48 घंटों के भीतर आपके संदेश की समीक्षा करेगी',
            step2: 'आपको इस ईमेल पते पर प्रतिक्रिया प्राप्त होगी',
            step3: 'तत्काल मामलों के लिए, कृपया हमारी सहायता लाइन पर कॉल करें',
            thanksPatience: 'हम आपके धैर्य की सराहना करते हैं और आपकी मदद करने के लिए तत्पर हैं!',
            subject: 'हमें आपका संदेश मिल गया है'
        }
    };

    const s = i18n[lang] || i18n.en;
    const firstName = name ? name.split(' ')[0] : (lang === 'hi' ? 'जी' : 'there');

    const content = `
        <h2>${s.title}</h2>
        <p>${common.dear} ${firstName},</p>
        <p>${s.received}</p>
        
        <div class="info-box">
            <strong>${s.nextSteps}</strong>
            <ul style="margin: 5px 0;">
                <li>${s.step1}</li>
                <li>${s.step2}</li>
                <li>${s.step3}</li>
            </ul>
        </div>
        
        <p>${s.thanksPatience}</p>
        <p class="text-muted">${common.withRegards},<br>${common.team}</p>
    `;

    return {
        subject: `${s.subject} - ${APP_NAME}`,
        html: wrapInTemplate(content, { title: s.title, lang })
    };
}

module.exports = {
    getContactFormEmail,
    getContactAutoReplyEmail
};
