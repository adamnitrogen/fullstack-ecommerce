/**
 * CHECKOUT SERVICE - DELIVERY INTEGRATION SCRIPT
 * 
 * This file contains the complete, ready-to-apply code changes for checkout.service.js
 * Apply these changes manually, section by section, to integrate delivery charges
 */

// ====================================================================
// SECTION 1: Import DeliveryChargeService at top of file (after line 15)
// ====================================================================

const { DeliveryChargeService } = require('./delivery-charge.service');


// ====================================================================
// SECTION 2: Update createRazorpayInvoice function
// Find function createRazorpayInvoice (around line 105)
// Replace the try block content with this:
// ====================================================================

const createRazorpayInvoice = async (amount, receipt, customer, lineItems) => {
    log.operationStart('CREATE_RAZORPAY_INVOICE', { amount, receipt });
    const startTime = Date.now();

    try {
        // Extract delivery charge and GST from metadata
        let deliveryCharge = 0;
        let deliveryGST = 0;
        let deliveryGSTRate = 18;

        // Check if first item has delivery metadata
        if (lineItems.length > 0 && lineItems[0].deliveryCharge !== undefined) {
            deliveryCharge = lineItems[0].deliveryCharge || 0;
            deliveryGST = lineItems[0].deliveryGST || 0;
            deliveryGSTRate = lineItems[0].deliveryGSTRate || 18;
        }

        // Clean line items (remove delivery metadata)
        const cleanLineItems = lineItems.map(item => {
            const { deliveryCharge, deliveryGST, deliveryGSTRate, ...rest } = item;
            return rest;
        });

        // Add delivery charges as separate Razorpay line item (GST-compliant)
        if (deliveryCharge > 0) {
            cleanLineItems.push({
                name: "Delivery Charges",
                description: "Courier and handling charges",
                amount: Math.round(deliveryCharge * 100), // Paisa (before GST)
                currency: "INR",
                quantity: 1,
                tax_rate: deliveryGSTRate,
                hsn_code: "996812" // SAC code for courier services
            });
        }

        // Construct Invoice Payload
        const payload = {
            type: 'invoice',
            description: `Order ${receipt}`,
            date: Math.floor(Date.now() / 1000),
            customer: {
                name: customer.name,
                email: customer.email,
                contact: customer.phone
            },
            line_items: cleanLineItems,
            receipt: receipt,
            sms_notify: 1,
            email_notify: 1
        };

        // Rest of the function stays the same...
        const invoice = await razorpay.invoices.create(payload);

        log.operationSuccess('CREATE_RAZORPAY_INVOICE', {
            invoiceId: invoice.id,
            orderId: invoice.order_id,
            amount: invoice.amount
        }, Date.now() - startTime);

        return {
            id: invoice.order_id,
            invoice_id: invoice.id,
            amount: invoice.amount || Math.round(amount * 100),
            currency: invoice.currency,
            status: invoice.status
        };
    } catch (error) {
        log.operationError('CREATE_RAZORPAY_INVOICE', error, { amount, receipt });
        throw new Error(`Failed to create Razorpay invoice: ${error.message}`);
    }
};


// ====================================================================
// SECTION 3: Update createOrder function - orderData
// Find the orderData object (around line 320-344)
// Add delivery_gst after delivery_charge:
// ====================================================================

const orderData = {
    customerName: profile.name,
    customerEmail: profile.email,
    customerPhone: profile.phone,
    shipping_address_id,
    billing_address_id,
    shippingAddress: shippingAddr,
    totalAmount: totals.finalAmount,
    subtotal: totals.totalPrice,
    coupon_code: totals.coupon?.code || null,
    coupon_discount: totals.couponDiscount || 0,
    delivery_charge: totals.deliveryCharge || 0,
    delivery_gst: totals.deliveryGST || 0,  // ADD THIS LINE
    status: 'pending',
    paymentStatus: 'pending',
    notes,
    total_taxable_amount: taxResult?.summary.taxableAmount || 0,
    total_cgst: taxResult?.summary.cgst || 0,
    total_sgst: taxResult?.summary.sgst || 0,
    total_igst: taxResult?.summary.igst || 0
};


// ====================================================================
// SECTION 4: Update createOrder function - orderItems preparation
// Find where orderItems are created (around line 346-392)
// REPLACE the entire orderItems mapping with this for loop:
// ====================================================================

// Prepare order items with tax and delivery snapshots
const orderItems = [];
for (const [index, item] of cart.cart_items.entries()) {
    const taxBreakdown = taxResult?.items[index]?.taxBreakdown || {};
    const variant = item.product_variants || item.variant || {};
    const product = item.products || item.product || {};

    // Find applicable discount for this item
    const itemDetail = totals.itemBreakdown?.find(id =>
        (id.variant_id && id.variant_id === item.variant_id) ||
        (!id.variant_id && id.product_id === item.product_id)
    );

    // Calculate delivery charge for this item
    let itemDeliveryCharge = 0;
    let itemDeliveryGST = 0;
    let deliverySnapshot = null;

    try {
        const deliveryResult = await DeliveryChargeService.calculateDeliveryCharge(
            item.product_id,
            item.variant_id,
            item.quantity
        );
        itemDeliveryCharge = deliveryResult.deliveryCharge;
        itemDeliveryGST = deliveryResult.deliveryGST;
        deliverySnapshot = deliveryResult.snapshot;
    } catch (error) {
        logger.warn({ err: error, product_id: item.product_id }, 'Failed to calculate item delivery');
    }

    orderItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        product: {
            id: product.id || item.product_id,
            title: product.title || 'Product',
            price: variant.selling_price || product.price || 0,
            images: product.images || [],
            isReturnable: product.isReturnable ?? product.is_returnable ?? true
        },
        // Financial details
        delivery_charge: itemDeliveryCharge,
        delivery_gst: itemDeliveryGST,
        delivery_calculation_snapshot: deliverySnapshot,
        coupon_id: totals.coupon?.id || null,
        coupon_code: totals.coupon?.code || null,
        coupon_discount: itemDetail?.coupon_discount || 0,
        // Tax snapshot (immutable)
        taxable_amount: taxBreakdown.taxableAmount || null,
        cgst: taxBreakdown.cgst || 0,
        sgst: taxBreakdown.sgst || 0,
        igst: taxBreakdown.igst || 0,
        hsn_code: taxBreakdown.hsnCode || null,
        gst_rate: taxBreakdown.gstRate || null,
        total_amount: taxBreakdown.totalAmount || null,
        variant_snapshot: variant.id ? {
            variant_id: variant.id,
            size_label: variant.size_label,
            selling_price: variant.selling_price,
            mrp: variant.mrp,
            description: variant.description,
            tax_applicable: variant.tax_applicable || false,
            price_includes_tax: variant.price_includes_tax ?? true
        } : null
    });
}


// ====================================================================
// SECTION 5: Add delivery metadata before createRazorpayInvoice call
// Find where createRazorpayInvoice is called (around line 580-600)
// Add this code BEFORE the call:
// ====================================================================

// Add delivery metadata to line items for Razorpay invoice
if (razorpayLineItems.length > 0) {
    razorpayLineItems[0].deliveryCharge = totals.deliveryCharge || 0;
    razorpayLineItems[0].deliveryGST = totals.deliveryGST || 0;
    razorpayLineItems[0].deliveryGSTRate = 18;
}

const razorpayInvoice = await createRazorpayInvoice(
    totals.finalAmount,
    orderData.orderNumber,
    customer,
    razorpayLineItems
);


// ====================================================================
// TESTING CHECKLIST
// ====================================================================
/*
After applying these changes:

1. Restart backend server
2. Test cart API - should show deliveryCharge and deliveryGST
3. Create test order - check database:
   - orders table: delivery_gst column populated
   - order_items table: delivery_gst and delivery_calculation_snapshot populated
4. Check Razorpay invoice has separate "Delivery Charges" line item with HSN 996812
5. Verify logs show delivery calculations

IMPORTANT NOTES:
- All changes are backward compatible
- If delivery config doesn't exist, charges default to 0
- Delivery snapshots provide full audit trail
- GST compliance maintained throughout
*/
