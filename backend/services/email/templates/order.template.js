/**
 * Order Email Templates
 */
const { wrapInTemplate, APP_NAME } = require('./base.template');

/**
 * Order confirmation email
 */
function getOrderConfirmationEmail({ order, customerName }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';

    const itemsHtml = order.items?.map(item => {
        // Handle both flat structure and new snapshot structure
        const product = item.product || {};
        const variant = item.variant_snapshot || item.variant || {};

        const title = product.title || item.title || item.name || 'Product';
        const variantLabel = variant.size_label ? ` <span style="color: #666; font-size: 12px;">(${variant.size_label})</span>` : '';
        const price = item.price_per_unit || item.price || variant.selling_price || 0;
        const quantity = item.quantity || 1;
        const itemTotal = item.total_amount || (price * quantity);

        // Tax Info (if applicable)
        const taxInfo = (item.gst_rate || item.gstRate) ?
            `<br><span style="color: #888; font-size: 10px;">GST: ${item.gst_rate || item.gstRate}% (HSN: ${item.hsn_code || 'N/A'})</span>` : '';

        return `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>${title}</strong>${variantLabel}
                ${taxInfo}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                ${quantity}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                ₹${itemTotal.toFixed(2)}
            </td>
        </tr>
        `;
    }).join('') || '';

    const displayOrderNumber = order.orderNumber || order.order_number || order.id;

    // Address Formatting
    const formatAddr = (addr) => {
        if (!addr) return 'N/A';
        return `
            ${addr.full_name || addr.label || ''}<br>
            ${addr.street_address || addr.address_line1 || ''}, ${addr.apartment || addr.address_line2 || ''}<br>
            ${addr.city || ''}, ${addr.state || ''} - ${addr.postal_code || addr.postalCode || ''}<br>
            ${addr.country || 'India'}<br>
            Phone: ${addr.phone || addr.phone_number || 'N/A'}
        `;
    };

    const shippingAddrHtml = formatAddr(order.shippingAddress || order.shipping_address);
    const billingAddrHtml = formatAddr(order.billingAddress || order.billing_address);

    const content = `
        <h2>Order Confirmed! 🎉</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for your order. We've received your payment and are preparing your items.</p>
        
        <div class="success-box">
            <strong>Order Number:</strong> ${displayOrderNumber}<br>
            <strong>Order Date:</strong> ${new Date(order.createdAt || order.created_at || Date.now()).toLocaleDateString()}<br>
            <strong>Payment Status:</strong> ${(order.paymentStatus || 'Paid').toUpperCase()}
        </div>

        <div style="margin-top: 20px; margin-bottom: 20px;">
            <h3>Shipping Address</h3>
            <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
                ${shippingAddrHtml}
            </p>
        </div>

        <div style="margin-top: 20px; margin-bottom: 20px;">
            <h3>Billing Address</h3>
            <p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
                ${billingAddrHtml}
            </p>
        </div>
        
        <h3>Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 10px; text-align: left;">Item</th>
                    <th style="padding: 10px; text-align: center;">Qty</th>
                    <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="padding: 10px; text-align: right; border-top: 1px solid #eee;">Subtotal:</td>
                    <td style="padding: 10px; text-align: right; border-top: 1px solid #eee;">₹${(order.subtotal || 0).toFixed(2)}</td>
                </tr>
                ${order.delivery_charge ? `
                <tr>
                    <td colspan="2" style="padding: 10px; text-align: right;">Delivery:</td>
                    <td style="padding: 10px; text-align: right;">₹${order.delivery_charge.toFixed(2)}</td>
                </tr>
                ` : ''}
                ${(order.coupon_discount || 0) > 0 ? `
                <tr>
                    <td colspan="2" style="padding: 10px; text-align: right; color: green;">Discount:</td>
                    <td style="padding: 10px; text-align: right; color: green;">-₹${order.coupon_discount.toFixed(2)}</td>
                </tr>
                ` : ''}
                ${order.tax ? `
                <tr>
                    <td colspan="2" style="padding: 10px; text-align: right; color: #666; font-size: 12px;">
                        Tax (${order.tax.taxType === 'INTER' ? 'IGST' : 'CGST+SGST'}):
                    </td>
                    <td style="padding: 10px; text-align: right; color: #666; font-size: 12px;">
                        ₹${(order.tax.totalTax || 0).toFixed(2)}
                    </td>
                </tr>
                ` : ''}
                <tr style="font-weight: bold; font-size: 16px;">
                    <td colspan="2" style="padding: 15px; text-align: right; border-top: 2px solid #eee;">Total:</td>
                    <td style="padding: 15px; text-align: right; border-top: 2px solid #eee;">₹${(order.totalAmount || order.total_amount || order.amount || 0).toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
        
        <p class="text-muted">Thank you for shopping with us!<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Order Confirmed - ${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: 'Order Confirmation' })
    };
}

/**
 * Order status update email
 */
function getOrderStatusUpdateEmail({ order, customerName, newStatus }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const displayOrderNumber = order.orderNumber || order.order_number || order.id;

    const statusMessages = {
        'shipped': 'Your order has been shipped! 🚚',
        'delivered': 'Your order has been delivered! 📦',
        'cancelled': 'Your order has been cancelled.',
        'processing': 'Your order is being processed.'
    };

    const content = `
        <h2>${statusMessages[newStatus] || `Order Status: ${newStatus}`}</h2>
        <p>Hi ${firstName},</p>
        <p>Your order <strong>${displayOrderNumber}</strong> status has been updated.</p>
        
        <div class="info-box">
            <strong>New Status:</strong> ${newStatus.toUpperCase()}
        </div>

        ${newStatus === 'cancelled' && (order.paymentStatus === 'paid' || order.paymentStatus === 'refund_initiated' || order.paymentStatus === 'refunded') ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #e2e3e5; border: 1px solid #d6d8db; border-radius: 5px;">
            <p style="margin: 0; color: #383d41;">
                <strong>Refund Information:</strong><br>
                A refund for <strong>₹${(order.totalAmount || 0).toFixed(2)}</strong> has been initiated immediately to your original payment source.<br>
                It typically takes <strong>5-7 business days</strong> for the amount to reflect in your account.
            </p>
        </div>
        ` : ''}

        ${newStatus === 'delivered' && order.invoiceUrl ? `
        <div style="margin-top: 20px; text-align: center;">
            <a href="${order.invoiceUrl}" style="background-color: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                📄 Download GST Invoice
            </a>
            <p style="margin-top: 10px; font-size: 12px; color: #666;">
                Click to view and download your tax invoice.
            </p>
        </div>
        ` : ''}
        
        <p class="text-muted">Thank you for shopping with us!</p>
    `;

    return {
        subject: `Order Update - ${displayOrderNumber}`,
        html: wrapInTemplate(content)
    };
}

module.exports = {
    getOrderConfirmationEmail,
    getOrderStatusUpdateEmail
};
