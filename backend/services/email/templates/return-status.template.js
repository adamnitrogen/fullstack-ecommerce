/**
 * Return Status Email Templates
 * Sent when return is requested, approved, or rejected
 */

const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');

/**
 * Get Return Requested email
 */
function getReturnRequestedEmail({ customerName, order, returnItems, reason }) {
    const orderNumber = order.order_number || order.id?.slice(0, 8).toUpperCase();

    let itemsHtml = '';
    if (returnItems?.length > 0) {
        itemsHtml = returnItems.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                <div>
                    <strong>${item.title || item.productTitle || 'Product'}</strong>
                    ${item.variantLabel ? `<span style="color: #6c757d;"> - ${item.variantLabel}</span>` : ''}
                </div>
                <div style="color: #6c757d;">Qty: ${item.quantity}</div>
            </div>
        `).join('');
    }

    const content = `
        <h2>Return Request Received 📦</h2>
        
        <p>Dear ${customerName || 'Valued Customer'},</p>
        
        <p>We've received your return request and are reviewing it. Here are the details:</p>
        
        <div class="info-box">
            <strong>Order #${orderNumber}</strong><br>
            Return requested on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        
        ${itemsHtml ? `
        <h3 style="margin-top: 30px;">Items for Return</h3>
        ${itemsHtml}
        ` : ''}
        
        ${reason ? `
        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 6px;">
            <strong>Reason for Return:</strong><br>
            ${reason}
        </div>
        ` : ''}
        
        <h3 style="margin-top: 30px;">What's Next?</h3>
        <ol style="color: #555;">
            <li>Our team will review your return request within 24-48 hours</li>
            <li>You'll receive an email once the request is approved or if we need more information</li>
            <li>Upon approval, we'll provide pickup or drop-off instructions</li>
        </ol>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/orders/${order.id}" class="button" style="color: #ffffff;">
                Track Return Status
            </a>
        </p>
        
        <p class="text-muted">
            If you have any questions about your return, please contact our support team.
        </p>
    `;

    return {
        subject: `Return Request Received for Order #${orderNumber}`,
        html: wrapInTemplate(content, { title: 'Return Request Received' })
    };
}

/**
 * Get Return Approved email
 */
function getReturnApprovedEmail({ customerName, order, estimatedRefund, pickupInstructions }) {
    const orderNumber = order.order_number || order.id?.slice(0, 8).toUpperCase();
    const refundAmount = (estimatedRefund || 0).toFixed(2);

    const content = `
        <h2>Return Request Approved ✅</h2>
        
        <p>Dear ${customerName || 'Valued Customer'},</p>
        
        <p>Great news! Your return request has been approved.</p>
        
        <div class="success-box">
            <strong>Order #${orderNumber}</strong><br>
            Estimated Refund: <strong>₹${refundAmount}</strong>
        </div>
        
        <h3 style="margin-top: 30px;">Next Steps</h3>
        
        ${pickupInstructions ? `
        <div class="info-box">
            <strong>Pickup Instructions:</strong><br>
            ${pickupInstructions}
        </div>
        ` : `
        <div class="info-box">
            <strong>How to Return:</strong>
            <ol style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Pack the item(s) securely in original packaging if available</li>
                <li>Include the order invoice or a note with your order number</li>
                <li>Our pickup partner will contact you within 2-3 business days</li>
            </ol>
        </div>
        `}
        
        <div class="warning-box">
            <strong>Important:</strong> Please ensure items are in their original condition with all tags attached. Items that show signs of use may be rejected upon inspection.
        </div>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/orders/${order.id}" class="button" style="color: #ffffff;">
                View Order Details
            </a>
        </p>
        
        <p class="text-muted">
            Once we receive and inspect the returned item(s), we'll process your refund within 5-7 business days.
        </p>
    `;

    return {
        subject: `Return Approved for Order #${orderNumber} - ₹${refundAmount} Refund Pending`,
        html: wrapInTemplate(content, { title: 'Return Approved' })
    };
}

/**
 * Get Return Rejected email
 */
function getReturnRejectedEmail({ customerName, order, reason }) {
    const orderNumber = order.order_number || order.id?.slice(0, 8).toUpperCase();

    const content = `
        <h2>Return Request Update</h2>
        
        <p>Dear ${customerName || 'Valued Customer'},</p>
        
        <p>We've reviewed your return request for Order #${orderNumber}.</p>
        
        <div class="warning-box">
            <strong>Unfortunately, we're unable to process this return.</strong>
        </div>
        
        ${reason ? `
        <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 6px;">
            <strong>Reason:</strong><br>
            ${reason}
        </div>
        ` : ''}
        
        <h3 style="margin-top: 30px;">What You Can Do</h3>
        <ul style="color: #555;">
            <li>If you believe this is an error, please contact our support team with additional details</li>
            <li>You can check our <a href="${FRONTEND_URL}/policies/return" style="color: #667eea;">return policy</a> for more information</li>
        </ul>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/contact" class="button" style="color: #ffffff;">
                Contact Support
            </a>
        </p>
        
        <p class="text-muted">
            We apologize for any inconvenience and are happy to help resolve any issues.
        </p>
    `;

    return {
        subject: `Update on Return Request for Order #${orderNumber}`,
        html: wrapInTemplate(content, { title: 'Return Request Update' })
    };
}

module.exports = {
    getReturnRequestedEmail,
    getReturnApprovedEmail,
    getReturnRejectedEmail
};
