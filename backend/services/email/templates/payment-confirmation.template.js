/**
 * Payment Confirmation Email Template
 * Sent immediately after successful payment capture
 */

const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');

function getPaymentConfirmationEmail({ customerName, order, paymentId, amount, method }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const orderNumber = order.order_number || order.id;

    const content = `
        <h2>Payment Received! ✅</h2>
        <p>Hi ${firstName},</p>
        <p>We've successfully received your payment for Order <strong>#${orderNumber}</strong>.</p>
        
        <div class="success-box">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">₹${parseFloat(amount).toFixed(2)}</div>
            <div style="color: #666; font-size: 14px;">Transaction ID: ${paymentId}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Method: ${method ? method.toUpperCase() : 'Online Payment'}</div>
        </div>

        <div style="margin: 20px 0;">
            <p>Your order is now being processed. We will notify you once it's shipped.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${FRONTEND_URL}/orders/${order.id}" class="button">
                View Order Details
            </a>
        </div>
        
        <p class="text-muted">Thank you for shopping with us!<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Payment Receipt - Order #${orderNumber}`,
        html: wrapInTemplate(content, { title: 'Payment Confirmed' })
    };
}

module.exports = {
    getPaymentConfirmationEmail
};
