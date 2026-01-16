/**
 * GST Invoice Email Template
 * Sent after order delivery when Razorpay invoice is generated
 */

const { wrapInTemplate, APP_NAME, FRONTEND_URL } = require('./base.template');

/**
 * Get GST Invoice Generated email
 */
function getGSTInvoiceEmail({ customerName, order, invoiceUrl, taxBreakdown }) {
    const orderNumber = order.order_number || order.id?.slice(0, 8).toUpperCase();
    const totalAmount = (order.total_amount || 0).toFixed(2);

    // Build tax summary section
    let taxSummaryHtml = '';
    if (taxBreakdown && taxBreakdown.totalTax > 0) {
        const isInterState = taxBreakdown.taxType === 'INTER';

        taxSummaryHtml = `
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f8f9fa;">
                    <td style="padding: 12px; border: 1px solid #e9ecef;"><strong>Taxable Amount</strong></td>
                    <td style="padding: 12px; border: 1px solid #e9ecef; text-align: right;">₹${taxBreakdown.totalTaxableAmount?.toFixed(2) || '0.00'}</td>
                </tr>
                ${isInterState ? `
                <tr>
                    <td style="padding: 12px; border: 1px solid #e9ecef;">IGST</td>
                    <td style="padding: 12px; border: 1px solid #e9ecef; text-align: right;">₹${taxBreakdown.totalIgst?.toFixed(2) || '0.00'}</td>
                </tr>
                ` : `
                <tr>
                    <td style="padding: 12px; border: 1px solid #e9ecef;">CGST</td>
                    <td style="padding: 12px; border: 1px solid #e9ecef; text-align: right;">₹${taxBreakdown.totalCgst?.toFixed(2) || '0.00'}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e9ecef;">SGST</td>
                    <td style="padding: 12px; border: 1px solid #e9ecef; text-align: right;">₹${taxBreakdown.totalSgst?.toFixed(2) || '0.00'}</td>
                </tr>
                `}
                <tr style="background-color: #e7f3ff;">
                    <td style="padding: 12px; border: 1px solid #e9ecef;"><strong>Total Tax</strong></td>
                    <td style="padding: 12px; border: 1px solid #e9ecef; text-align: right;"><strong>₹${taxBreakdown.totalTax?.toFixed(2) || '0.00'}</strong></td>
                </tr>
                <tr style="background-color: #d4edda;">
                    <td style="padding: 12px; border: 1px solid #e9ecef;"><strong>Total Paid</strong></td>
                    <td style="padding: 12px; border: 1px solid #e9ecef; text-align: right;"><strong>₹${totalAmount}</strong></td>
                </tr>
            </table>
        `;
    }

    // Build order items section
    let itemsHtml = '';
    if (order.order_items?.length > 0) {
        itemsHtml = order.order_items.map(item => {
            const itemName = item.title || item.variant_snapshot?.product_title || 'Product';
            const variant = item.variant_snapshot?.size_label ? ` - ${item.variant_snapshot.size_label}` : '';
            const hsnCode = item.hsn_code ? `<span style="color: #6c757d; font-size: 12px;"> (HSN: ${item.hsn_code})</span>` : '';
            const qty = item.quantity || 1;
            const amount = ((item.total_amount || item.price_per_unit * qty) || 0).toFixed(2);

            return `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                    <div>
                        <strong>${itemName}${variant}</strong>${hsnCode}
                        <div style="color: #6c757d; font-size: 14px;">Qty: ${qty}</div>
                    </div>
                    <div style="text-align: right;">
                        <strong>₹${amount}</strong>
                    </div>
                </div>
            `;
        }).join('');
    }

    const content = `
        <h2>Your GST Invoice is Ready! 📄</h2>
        
        <p>Dear ${customerName || 'Valued Customer'},</p>
        
        <p>Great news! Your order has been delivered and your GST-compliant tax invoice is now available for download.</p>
        
        <div class="success-box">
            <strong>Order #${orderNumber}</strong><br>
            Invoice generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        
        ${itemsHtml ? `
        <h3 style="margin-top: 30px;">Order Items</h3>
        ${itemsHtml}
        ` : ''}
        
        ${taxSummaryHtml ? `
        <h3 style="margin-top: 30px;">Tax Summary</h3>
        ${taxSummaryHtml}
        ` : `
        <div style="padding: 20px; text-align: center; background-color: #f8f9fa; margin: 20px 0;">
            <strong>Total Paid: ₹${totalAmount}</strong>
        </div>
        `}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${invoiceUrl || FRONTEND_URL + '/orders/' + order.id}" class="button" style="color: #ffffff;">
                Download Invoice
            </a>
        </div>
        
        <div class="info-box">
            <strong>Why keep this invoice?</strong><br>
            This GST invoice is your official tax document. You may need it for:
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Input Tax Credit (if applicable)</li>
                <li>Warranty claims</li>
                <li>Returns and refunds</li>
            </ul>
        </div>
        
        <p class="text-muted">
            If you have any questions about your order or invoice, please don't hesitate to contact our support team.
        </p>
    `;

    return {
        subject: `Your GST Invoice for Order #${orderNumber} is Ready`,
        html: wrapInTemplate(content, { title: 'GST Invoice Ready' })
    };
}

module.exports = { getGSTInvoiceEmail };
