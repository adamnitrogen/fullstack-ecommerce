/**
 * Refund Status Email Templates
 * Sent when refund is initiated or completed
 */

const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');

/**
 * Get Refund Initiated email
 */
function getRefundInitiatedEmail({ customerName, order, refundBreakdown }) {
    const orderNumber = order.order_number || order.id?.slice(0, 8).toUpperCase();
    const totalRefund = (refundBreakdown?.totalRefund || refundBreakdown?.summary?.totalRefund || 0).toFixed(2);

    // Build refund items section
    let itemsHtml = '';
    const items = refundBreakdown?.items || [];
    if (items.length > 0) {
        itemsHtml = items.map(item => {
            return `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                    <div>
                        <strong>${item.productTitle || 'Product'}</strong>
                        <div style="color: #6c757d; font-size: 14px;">Qty returned: ${item.returnQuantity}</div>
                    </div>
                    <div style="text-align: right;">
                        <strong>₹${item.totalRefund?.toFixed(2) || '0.00'}</strong>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Tax refund breakdown
    const summary = refundBreakdown?.summary || refundBreakdown || {};
    let taxRefundHtml = '';
    if (summary.totalTaxRefund > 0) {
        taxRefundHtml = `
            <div style="background-color: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Base Amount Refund:</span>
                    <span>₹${summary.taxableRefund?.toFixed(2) || '0.00'}</span>
                </div>
                ${summary.igstRefund > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>IGST Refund:</span>
                    <span>₹${summary.igstRefund.toFixed(2)}</span>
                </div>
                ` : `
                <div style="display: flex; justify-content: space-between;">
                    <span>CGST Refund:</span>
                    <span>₹${summary.cgstRefund?.toFixed(2) || '0.00'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>SGST Refund:</span>
                    <span>₹${summary.sgstRefund?.toFixed(2) || '0.00'}</span>
                </div>
                `}
            </div>
        `;
    }

    const content = `
        <h2>Refund Initiated 💰</h2>
        
        <p>Dear ${customerName || 'Valued Customer'},</p>
        
        <p>We've initiated a refund for your order. Here are the details:</p>
        
        <div class="info-box">
            <strong>Order #${orderNumber}</strong><br>
            Refund initiated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        
        ${itemsHtml ? `
        <h3 style="margin-top: 30px;">Items Being Refunded</h3>
        ${itemsHtml}
        ` : ''}
        
        ${taxRefundHtml ? `
        <h3 style="margin-top: 20px;">Refund Breakdown</h3>
        ${taxRefundHtml}
        ` : ''}
        
        <div style="background-color: #d4edda; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <div style="font-size: 14px; color: #155724;">Total Refund Amount</div>
            <div style="font-size: 28px; font-weight: bold; color: #155724;">₹${totalRefund}</div>
        </div>
        
        <div class="warning-box">
            <strong>Processing Time</strong><br>
            Refunds typically take 5-7 business days to reflect in your account, depending on your bank.
        </div>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/orders/${order.id}" class="button" style="color: #ffffff;">
                View Order Details
            </a>
        </p>
        
        <p class="text-muted">
            If you don't see the refund after 10 business days, please contact our support team with your order number.
        </p>
    `;

    return {
        subject: `Refund of ₹${totalRefund} Initiated for Order #${orderNumber}`,
        html: wrapInTemplate(content, { title: 'Refund Initiated' })
    };
}

/**
 * Get Refund Completed email
 */
function getRefundCompletedEmail({ customerName, order, refundId, amount, creditNoteRef }) {
    const orderNumber = order?.order_number || order?.id?.slice(0, 8).toUpperCase() || 'N/A';
    const refundAmount = (amount || 0).toFixed(2);

    const content = `
        <h2>Refund Completed ✅</h2>
        
        <p>Dear ${customerName || 'Valued Customer'},</p>
        
        <p>Great news! Your refund has been successfully processed.</p>
        
        <div class="success-box">
            <strong>Refund Amount: ₹${refundAmount}</strong><br>
            Order #${orderNumber}
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #6c757d;">Refund Reference</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: right;"><strong>${refundId || 'Processing'}</strong></td>
            </tr>
            ${creditNoteRef ? `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #6c757d;">Credit Note</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: right;"><strong>${creditNoteRef}</strong></td>
            </tr>
            ` : ''}
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #6c757d;">Processed On</td>
                <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: right;">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
            </tr>
        </table>
        
        <div class="info-box">
            The refund has been credited to your original payment method. It may take 2-3 business days to appear in your account statement.
        </div>
        
        <p style="text-align: center;">
            <a href="${FRONTEND_URL}/orders/${order?.id || ''}" class="button" style="color: #ffffff;">
                View Order
            </a>
        </p>
        
        <p class="text-muted">
            Thank you for your patience. We hope to serve you again soon!
        </p>
    `;

    return {
        subject: `Refund of ₹${refundAmount} Completed for Order #${orderNumber}`,
        html: wrapInTemplate(content, { title: 'Refund Completed' })
    };
}

module.exports = { getRefundInitiatedEmail, getRefundCompletedEmail };
