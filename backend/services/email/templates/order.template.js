/**
 * Order Email Templates
 */
const { wrapInTemplate, APP_NAME } = require('./base.template');

/**
 * Helper to format items table
 */
function getItemsTableHtml(order) {
    const itemsHtml = order.items?.map(item => {
        const product = item.product || {};
        const variant = item.variant_snapshot || item.variant || {};
        const title = product.title || item.title || item.name || 'Product';
        const variantLabel = variant.size_label ? ` <span style="color: #666; font-size: 12px;">(${variant.size_label})</span>` : '';
        const price = item.price_per_unit || item.price || variant.selling_price || 0;
        const quantity = item.quantity || 1;
        const itemTotal = item.total_amount || (price * quantity);

        return `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>${title}</strong>${variantLabel}
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

    return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
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
                <td style="padding: 10px; text-align: right;">₹${((order.delivery_charge || 0) + (order.delivery_gst || 0)).toFixed(2)}</td>
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
                    Tax (${order.tax.tax_type === 'INTER' ? 'IGST' : 'CGST+SGST'}):
                </td>
                <td style="padding: 10px; text-align: right; color: #666; font-size: 12px;">
                    ₹${(order.tax.total_tax || 0).toFixed(2)}
                </td>
            </tr>
            ` : ''}
            <tr style="font-weight: bold; font-size: 16px;">
                <td colspan="2" style="padding: 15px; text-align: right; border-top: 2px solid #eee;">Total:</td>
                <td style="padding: 15px; text-align: right; border-top: 2px solid #eee;">₹${(order.total_amount || 0).toFixed(2)}</td>
            </tr>
        </tfoot>
    </table>
    `;
}

/**
 * Helper to format address
 */
function formatAddr(addr) {
    if (!addr) return 'N/A';
    return `
        ${addr.full_name || addr.label || ''}<br>
        ${addr.street_address || addr.address_line1 || ''}, ${addr.apartment || addr.address_line2 || ''}<br>
        ${addr.city || ''}, ${addr.state || ''} - ${addr.postal_code || addr.postalCode || ''}<br>
        ${addr.country || 'India'}<br>
        Phone: ${addr.phone || addr.phone_number || 'N/A'}
    `;
}

/**
 * 1. Order Placed Email (Pending)
 * Includes Razorpay receipt link
 */
function getOrderPlacedEmail({ order, customerName, receiptUrl }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const displayOrderNumber = order.order_number || order.id;

    const receiptSection = receiptUrl ? `
    <div style="margin: 30px 0; text-align: center;">
        <a href="${receiptUrl}" style="background-color: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
            📄 Download Payment Receipt
        </a>
        <p style="margin-top: 12px; font-size: 13px; color: #666;">
            Your payment receipt is ready for download.
        </p>
    </div>
    ` : '';

    const content = `
        <h2>Order Received! 🛍️</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for shopping with us! We have received your order <strong>#${displayOrderNumber}</strong> and it is currently under review.</p>
        
        <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>Order Status:</strong> PENDING CONFIRMATION<br>
            <strong>Order Date:</strong> ${new Date(order.created_at || Date.now()).toLocaleDateString('en-IN')}
        </div>

        ${receiptSection}

        <p>Our team will verify the details and notify you once the order is confirmed.</p>
        
        <p class="text-muted">Best regards,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Order Placed - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: 'Order Received' })
    };
}

/**
 * 2. Order Confirmed Email
 * Includes breakdown and addresses
 */
function getOrderConfirmedEmail({ order, customerName }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>Order Confirmed! 🎉</h2>
        <p>Great news ${firstName}!</p>
        <p>Your order <strong>#${displayOrderNumber}</strong> has been confirmed and is being prepared for shipping.</p>
        
        <div style="margin: 25px 0;">
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h4 style="margin-top: 0; color: #4a5568;">Shipping Address</h4>
                    <p style="font-size: 13px; color: #2d3748; margin-bottom: 0;">${formatAddr(order.shipping_address)}</p>
                </div>
                <div style="flex: 1; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h4 style="margin-top: 0; color: #4a5568;">Billing Address</h4>
                    <p style="font-size: 13px; color: #2d3748; margin-bottom: 0;">${formatAddr(order.billing_address)}</p>
                </div>
            </div>
        </div>

        <h3>Order Summary</h3>
        ${getItemsTableHtml(order)}
        
        <p style="margin-top: 20px;">We will notify you as soon as your order leaves our warehouse.</p>
        
        <p class="text-muted">Thank you for your patience!<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Order Confirmed - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: 'Order Confirmed' })
    };
}

/**
 * 3. Order Shipped Email
 * Includes 1-2 weeks timeline
 */
function getOrderShippedEmail({ order, customerName }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>Order Shipped! 🚚</h2>
        <p>Hi ${firstName},</p>
        <p>Your order <strong>#${displayOrderNumber}</strong> is on its way!</p>
        
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <h3 style="margin: 0; color: #92400e;">Expected Delivery</h3>
            <p style="font-size: 18px; font-weight: bold; color: #b45309; margin: 10px 0;">1 - 2 Weeks</p>
            <p style="margin: 0; font-size: 13px; color: #d97706;">We're working hard to get your Gau Mata products to you as soon as possible.</p>
        </div>

        <p>You can track your order status anytime by visiting our website.</p>
        
        <p class="text-muted">Happy waiting!<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Order Shipped - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: 'Order Shipped' })
    };
}

/**
 * 4. Order Delivered Email
 * Includes custom invoice link
 */
function getOrderDeliveredEmail({ order, customerName, invoiceUrl }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const displayOrderNumber = order.order_number || order.id;

    const invoiceSection = invoiceUrl ? `
    <div style="margin: 30px 0; text-align: center;">
        <a href="${invoiceUrl}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.25);">
            📄 Download Official GST Invoice
        </a>
        <p style="margin-top: 12px; font-size: 13px; color: #666;">
            Your tax invoice is now available for download.
        </p>
    </div>
    ` : '';

    const content = `
        <h2>Order Delivered! 📦</h2>
        <p>Hi ${firstName},</p>
        <p>Your order <strong>#${displayOrderNumber}</strong> has been successfully delivered. We hope you love your products!</p>
        
        <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; color: #065f46;">
            <strong>Status:</strong> DELIVERED<br>
            <strong>Delivery Date:</strong> ${new Date().toLocaleDateString('en-IN')}
        </div>

        ${invoiceSection}

        <p>We would love to hear your feedback. Feel free to reply to this email or leave a review on our website.</p>
        
        <p class="text-muted">Thank you for being a part of the ${APP_NAME} family!<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Order Delivered - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: 'Order Delivered' })
    };
}

/**
 * 5. Order Cancellation Email
 */
function getOrderCancellationEmail({ order, customerName }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>Order Cancelled 🛑</h2>
        <p>Hi ${firstName},</p>
        <p>As requested, your order <strong>#${displayOrderNumber}</strong> has been cancelled.</p>
        
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; color: #991b1b;">
            <strong>Status:</strong> CANCELLED
        </div>

        ${(order.payment_status === 'paid' || order.payment_status === 'refund_initiated' || order.payment_status === 'refunded') ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
                <strong>Refund Information:</strong><br>
                A refund of <strong>₹${(order.total_amount || 0).toFixed(2)}</strong> has been initiated to your original payment method. It usually takes 5-7 business days to reflect in your account.
            </p>
        </div>
        ` : ''}
        
        <p style="margin-top: 25px;">If you have any questions, please reach out to our support team.</p>
        <p class="text-muted">We hope to see you again soon.<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Order Cancelled - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: 'Order Cancelled' })
    };
}

/**
 * 6. Order Returned Email
 */
function getOrderReturnedEmail({ order, customerName }) {
    const firstName = customerName ? customerName.split(' ')[0] : 'Customer';
    const displayOrderNumber = order.order_number || order.id;

    const content = `
        <h2>Return Completed 📦</h2>
        <p>Hi ${firstName},</p>
        <p>Your returned items for order <strong>#${displayOrderNumber}</strong> have been received and processed at our warehouse.</p>
        
        <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin: 20px 0; color: #374151;">
            <strong>Status:</strong> RETURNED
        </div>

        <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
                <strong>Next Steps:</strong><br>
                Your refund (if applicable) is being processed. You can check the details on your order history page.
            </p>
        </div>
        
        <p class="text-muted" style="margin-top: 25px;">The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Return Processed - #${displayOrderNumber}`,
        html: wrapInTemplate(content, { title: 'Return Processed' })
    };
}

module.exports = {
    getOrderPlacedEmail,
    getOrderConfirmedEmail,
    getOrderShippedEmail,
    getOrderDeliveredEmail,
    getOrderCancellationEmail,
    getOrderReturnedEmail
};

