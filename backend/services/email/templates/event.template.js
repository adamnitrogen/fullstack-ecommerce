/**
 * Event Email Templates
 * - Event Registration Confirmation (free and paid events)
 * - Event Cancellation
 */
const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');

/**
 * Helper to extract location string from location (could be object or string)
 */
function getLocationString(location) {
    if (!location) return 'TBA';
    if (typeof location === 'string') return location;
    // If location is an object, try to extract meaningful parts
    if (typeof location === 'object') {
        const parts = [];
        if (location.venue) parts.push(location.venue);
        if (location.address) parts.push(location.address);
        if (location.city) parts.push(location.city);
        if (location.name) parts.push(location.name);
        return parts.length > 0 ? parts.join(', ') : JSON.stringify(location);
    }
    return String(location);
}

/**
 * Event registration confirmation email
 * Supports both free and paid events with optional invoice
 */
function getEventRegistrationEmail({ event, registration, attendeeName, isPaid = false, paymentDetails = null }) {
    const firstName = attendeeName ? attendeeName.split(' ')[0] : 'there';
    // Ensure event.startDate is parsed correctly
    const eventDate = new Date(event.startDate || event.date);

    // Extract time string from the date object
    const timeStr = event.startTime || eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Format date string
    const dateStr = eventDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const locationStr = getLocationString(event.location);

    // Payment section for paid events
    let paymentSection = '';
    if (isPaid && paymentDetails) {
        paymentSection = `
            <div class="info-box">
                <strong>Payment Details:</strong><br>
                💰 Amount Paid: ₹${paymentDetails.amount?.toFixed(2) || '0.00'}<br>
                🧾 Transaction ID: ${paymentDetails.transactionId || paymentDetails.razorpayPaymentId || 'N/A'}<br>
                📅 Payment Date: ${new Date(paymentDetails.paidAt || Date.now()).toLocaleDateString()}
                ${paymentDetails.invoiceUrl ? `<br><br><a href="${paymentDetails.invoiceUrl}" style="color: #667eea; text-decoration: underline;">📄 Download Invoice</a>` : ''}
            </div>
        `;
    } else if (!isPaid || (event.fee === 0)) {
        paymentSection = `
            <div class="info-box">
                <strong>🎉 This is a FREE event!</strong><br>
                No payment required.
            </div>
        `;
    }

    const content = `
        <h2>You're Registered! 🎟️</h2>
        <p>Hi ${firstName},</p>
        <p>Your registration for <strong>${event.title}</strong> has been confirmed.</p>
        
        <div class="success-box">
            <strong>Event Details:</strong><br>
            📅 Date: ${dateStr}<br>
            🕐 Time: ${timeStr}<br>
            📍 Location: ${locationStr}<br>
            🎫 Registration ID: ${registration.registrationNumber || registration.id}<br>
            ${event.eventCode ? `🆔 Event ID: ${event.eventCode}` : ''}
        </div>
        
        ${paymentSection}
        
        ${event.description ? `<p style="color: #666;">${event.description.substring(0, 300)}${event.description.length > 300 ? '...' : ''}</p>` : ''}
        
        <div class="warning-box">
            <strong>What to bring:</strong>
            <ul style="margin: 5px 0;">
                <li>This confirmation email (printed or on phone)</li>
                <li>Valid photo ID for verification</li>
                ${isPaid ? '<li>Payment receipt (if requested)</li>' : ''}
            </ul>
        </div>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/event/${event.id}" class="button">View Event Details</a>
        </p>
        
        <p>We look forward to seeing you there!</p>
        <p class="text-muted">Best regards,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Registration Confirmed - ${event.title}`,
        html: wrapInTemplate(content, { title: 'Event Registration Confirmed' })
    };
}

/**
 * Event cancellation email
 */
function getEventCancellationEmail({ event, registration, attendeeName, refundDetails = null }) {
    const firstName = attendeeName ? attendeeName.split(' ')[0] : 'there';
    const eventDate = new Date(event.startDate || event.date);
    const locationStr = getLocationString(event.location);

    // Refund section for paid events
    let refundSection = '';
    if (refundDetails) {
        if (refundDetails.isRefunded) {
            refundSection = `
                <div class="success-box">
                    <strong>Refund Processed:</strong><br>
                    💰 Refund Amount: ₹${refundDetails.amount?.toFixed(2) || '0.00'}<br>
                    🏦 Refund ID: ${refundDetails.refundId || 'N/A'}<br>
                    📅 Expected Credit: 5-7 business days
                </div>
            `;
        } else if (refundDetails.amount > 0) {
            refundSection = `
                <div class="info-box">
                    <strong>Refund Status:</strong><br>
                    Your refund of ₹${refundDetails.amount?.toFixed(2)} is being processed.<br>
                    It will be credited to your original payment method within 5-7 business days.
                </div>
            `;
        }
    }

    const content = `
        <h2>Registration Cancelled</h2>
        <p>Hi ${firstName},</p>
        <p>Your registration for <strong>${event.title}</strong> has been cancelled.</p>
        
        <div class="info-box">
            <strong>Cancelled Registration Details:</strong><br>
            📅 Event Date: ${eventDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br>
            📍 Location: ${locationStr}<br>
            🎫 Registration ID: ${registration.registrationNumber || registration.registration_number || registration.id}<br>
            ❌ Cancelled On: ${new Date().toLocaleDateString('en-IN')}
        </div>
        
        ${refundSection}
        
        <p>We're sorry to see you go! If you cancelled by mistake or would like to register again, you can do so from our events page.</p>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/events" class="button">Browse Other Events</a>
        </p>
        
        <p class="text-muted">If you have any questions about your cancellation or refund, please contact our support team.</p>
        <p class="text-muted">Best regards,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Registration Cancelled - ${event.title}`,
        html: wrapInTemplate(content, { title: 'Event Cancellation' })
    };
}

module.exports = {
    getEventRegistrationEmail,
    getEventCancellationEmail
};
