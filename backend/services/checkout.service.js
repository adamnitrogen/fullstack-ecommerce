const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { calculateCartTotals, getUserCart } = require('./cart.service');
const { getPrimaryAddress, getLatestAddress, getAddressById } = require('./address.service');
const { checkStockAvailability, decreaseInventory } = require('./inventory.service');
const emailService = require('./email');
const { RefundService, REFUND_TYPES } = require('./refund.service');
const { capturePayment, voidAuthorization } = require('../utils/razorpay-helper');
// Tax and Pricing
const { TaxEngine } = require('./tax-engine.service');
const { PricingCalculator } = require('./pricing-calculator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { DeliveryChargeService } = require('./delivery-charge.service');

// Create module-specific logger
const log = createModuleLogger('CheckoutService');

/**
 * Checkout Service
 * Handles checkout flow, Razorpay integration, and order creation
 */

// Initialize Razorpay
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

if (!key_secret) {
    logger.error('RAZORPAY_KEY_SECRET is missing in environment variables. Payment verification will fail.');
}

const razorpay = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});

// Get checkout summary (cart + addresses + totals + tax)
const getCheckoutSummary = async (userId, addressId = null) => {
    // Get cart with totals
    const cart = await getUserCart(userId);
    // PERFORMANCE: Pass existing cart to avoid refetching in calculateCartTotals
    const totals = await calculateCartTotals(userId, null, cart);

    // Get shipping address
    let shippingAddress = null;
    if (addressId) {
        // If specific address requested (e.g. user changed selection), fetch it
        try {
            shippingAddress = await getAddressById(addressId, userId);
        } catch (error) {
            logger.warn({ error, addressId }, 'Failed to fetch requested address, falling back to default');
        }
    }

    if (!shippingAddress) {
        // Default logic
        shippingAddress = await getPrimaryAddress(userId, 'shipping');
    }

    if (!shippingAddress) {
        shippingAddress = await getLatestAddress(userId, 'shipping');
    }
    if (!shippingAddress) {
        shippingAddress = await getLatestAddress(userId); // Fallback to any address
    }

    // Get primary billing address -> latest billing -> latest any
    let billingAddress = await getPrimaryAddress(userId, 'billing');
    if (!billingAddress) {
        billingAddress = await getLatestAddress(userId, 'billing');
    }
    if (!billingAddress) {
        billingAddress = await getLatestAddress(userId); // Fallback to any address
    }

    // Calculate taxes if shipping address is available
    let taxResult = null;
    if (shippingAddress && cart.cart_items?.length > 0) {
        try {
            taxResult = TaxEngine.calculateOrderTax(cart.cart_items, shippingAddress);

            // AGGREGATE DELIVERY GST INTO SUMMARY
            // totals has deliveryGST which is the SUM of global and product delivery GSTs
            const deliveryGstTotal = totals.deliveryGST || 0;
            if (deliveryGstTotal > 0) {
                taxResult.summary.totalTax += deliveryGstTotal;
                taxResult.summary.totalAmount += deliveryGstTotal; // Note: totalAmount in TaxEngine is taxable+tax

                if (taxResult.summary.taxType === 'INTER') {
                    taxResult.summary.totalIgst += deliveryGstTotal;
                } else {
                    const cgst = Math.round((deliveryGstTotal / 2) * 100) / 100;
                    const sgst = deliveryGstTotal - cgst;
                    taxResult.summary.totalCgst += cgst;
                    taxResult.summary.totalSgst += sgst;
                }
            }

            log.debug('CHECKOUT_TAX', 'Tax calculated inclusive of delivery', {
                taxType: taxResult.summary.taxType,
                totalTax: taxResult.summary.totalTax
            });
        } catch (err) {
            log.warn('CHECKOUT_TAX_ERROR', 'Failed to calculate taxes', { error: err.message });
        }
    }

    return {
        cart,
        totals,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        tax: taxResult ? {
            ...taxResult.summary,
            items: taxResult.items.map(item => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                ...item.taxBreakdown
            }))
        } : null
    };
};

// Create Razorpay INVOICE (replaces simple Order)
// This generates a detailed PDF Invoice + Email
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

        // Bundle Non-Refundable Delivery Logic
        // In local checkout service, we should determine which charges are refundable
        let nonRefundableDeliveryTotal = 0;
        let refundableDeliveryCharge = 0;

        // The lineItems passed here might already contain the delivery info if it was extracted before
        // However, the items typically have the delivery metadata if mapped from checkout.
        // Let's use the logic: Standard Delivery is always non-refundable.
        // Refundable is only if specific surcharge has policy.

        // If we don't have the full snapshots here, we look at the deliveryCharge passed
        // Note: createOrder calls this. 
        // Let's check how lineItems are passed to this function.
        // Wait, lineItems here are usually prepared in a way that matches Razorpay expected format.

        if (deliveryCharge > 0) {
            // Assume the global portion is non-refundable 
            // This is a bit tricky if we don't have item-level metadata here.
            // But usually this function is called from Checkout where we have the totals.

            // To be safe and consistent with InvoiceOrchestrator:
            // If the user wants to HIDE non-refundable charges (base or total),
            // and Standard Delivery is always non-refundable, we bundle the global portion.

            // FOR NOW: Treat ALL deliveryCharge passed here as non-refundable and bundle it
            // UNLESS it's explicitly marked as refundable (which it isn't in current signature).
            nonRefundableDeliveryTotal = deliveryCharge + deliveryGST;
        }

        // Pro-rate non-refundable delivery into product items
        if (nonRefundableDeliveryTotal > 0 && cleanLineItems.length > 0) {
            // Ensure first all items have a base amount (fallback to 0) to avoid NaN in reduce
            cleanLineItems.forEach(item => {
                if (item.amount === undefined || isNaN(item.amount)) {
                    item.amount = 0;
                }
            });

            const currentTotalAmount = cleanLineItems.reduce((sum, item) => sum + (item.amount * item.quantity), 0);

            if (currentTotalAmount > 0) {
                cleanLineItems.forEach((item, index) => {
                    // Remove item_id if bundling to ensure Razorpay uses our modified amount
                    delete item.item_id;

                    if (index === cleanLineItems.length - 1) {
                        const distributedSoFar = cleanLineItems.slice(0, -1).reduce((sum, it) => sum + (it._addedAmount || 0) * it.quantity, 0);
                        const remainder = Math.round(nonRefundableDeliveryTotal * 100) - distributedSoFar;
                        item.amount += Math.round(remainder / item.quantity);
                    } else {
                        const portion = (item.amount * item.quantity / currentTotalAmount) * (nonRefundableDeliveryTotal * 100);
                        const addedPerUnit = Math.round(portion / item.quantity);
                        item.amount += addedPerUnit;
                        item._addedAmount = addedPerUnit;
                    }
                    delete item._addedAmount;
                });
                log.info({ receipt, bundled: nonRefundableDeliveryTotal }, "Bundled delivery into Razorpay checkout line items");
            } else {
                // If total amount is 0 (e.g. donation?), just add it to the first item
                delete cleanLineItems[0].item_id;
                cleanLineItems[0].amount += Math.round(nonRefundableDeliveryTotal * 100);
            }
        }

        // Construct Invoice Payload
        const payload = {
            type: 'invoice',
            description: `Order ${receipt}`,
            date: Math.floor(Date.now() / 1000), // Unix timestamp
            customer: {
                name: customer.name,
                email: customer.email,
                ...(customer.phone && { contact: customer.phone })
            },
            line_items: cleanLineItems,
            receipt: receipt,
            sms_notify: 0,
            email_notify: 0
        };

        // Ensure proper contact format if possible, otherwise Razorpay might complain.
        // Assuming database phone is clean.

        // Wait! Razorpay Items + Invoice API flow is slightly different from Standard Checkout.
        // Standard Checkout needs `order_id` generated via `orders.create`.
        // `invoices.create` generates an invoice. 
        // DOES `invoices.create` returning an `order_id` compatible with checkout? 
        // Yes, `invoice.order_id` is linked.

        const invoice = await razorpay.invoices.create(payload);

        // If invoice is in draft, we might need to Issue it to get the link/email trigger?
        // But for "Checkout", we want the user to pay NOW.
        // Standard Checkout requires `order_id`.
        // If the invoice is created, it has an `order_id`.
        // We use that `order_id` on the frontend.
        // When the user pays that `order_id`, the Invoice status updates to Paid.

        log.operationSuccess('CREATE_RAZORPAY_INVOICE', {
            invoiceId: invoice.id,
            orderId: invoice.order_id,
            amount: invoice.amount
        }, Date.now() - startTime);

        // We return an object that looks like an "Order" to keep backend consistent
        // The frontend only cares about `id` (which should be order_id)
        return {
            id: invoice.order_id, // CRITICAL: Frontend expects Order ID, not Invoice ID
            invoice_id: invoice.id,
            amount: invoice.amount || Math.round(amount * 100),
            currency: invoice.currency,
            status: invoice.status
        };
    } catch (error) {
        log.operationError('CREATE_RAZORPAY_INVOICE', error, { amount, receipt });
        // Fallback: If Invoice creation fails (e.g. invalid customer data), 
        // should we fail hard or fallback to generic Order?
        // User requested "Invoice Integration", implying if it fails, we should fix it.
        // Failing hard is better than silent generic orders if the goal is GST compliance.
        throw new Error(`Failed to create Razorpay invoice: ${error.message}`);
    }
};

// Verify Razorpay payment signature
const verifyRazorpayPayment = (orderId, paymentId, signature) => {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_secret_key')
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
};

// Create payment record
const createPaymentRecord = async (paymentData) => {
    const { data, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Update payment record
const updatePaymentRecord = async (paymentId, updates) => {
    const { data, error } = await supabase
        .from('payments')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Create order with all details - TRANSACTIONAL VERSION
// All database operations are executed atomically via PostgreSQL function
const createOrder = async (userId, checkoutData, cart) => {
    const {
        shipping_address_id,
        billing_address_id,
        payment_id,
        notes
    } = checkoutData;


    // PERFORMANCE: Pass existing cart to avoid refetching in calculateCartTotals
    const totals = await calculateCartTotals(userId, null, cart);

    // Check stock availability BEFORE processing order
    const stockCheck = await checkStockAvailability(cart.cart_items);
    if (!stockCheck.available) {
        const itemNames = stockCheck.insufficientItems.map(i => i.title || i.product_id).join(', ');
        throw new Error(`Insufficient stock for: ${itemNames}`);
    }

    // --- COUPON SAFETY GUARD ---
    if (cart.applied_coupon_code) {
        // Force live check for critical operation
        const { validateCoupon } = require('./coupon.service');
        const validation = await validateCoupon(cart.applied_coupon_code, userId, cart.cart_items, totals.totalPrice, true);

        if (!validation.valid) {
            log.warn('STALE_COUPON_REJECTED', 'Coupon became invalid during checkout session', {
                coupon: cart.applied_coupon_code,
                error: validation.error
            });
            throw new Error(`Coupon "${cart.applied_coupon_code}" is no longer valid: ${validation.error}. Please remove or change the coupon to proceed.`);
        }
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name, email, phone')
        .eq('id', userId)
        .single();

    if (profileError) throw profileError;

    // Get addresses with error handling (and phone numbers)
    const { data: shippingAddrData, error: shippingError } = await supabase
        .from('addresses')
        .select('*, phone_numbers(phone_number)')
        .eq('id', shipping_address_id)
        .single();

    if (shippingError || !shippingAddrData) {
        logger.error({ err: shipping_address_id, shippingError }, 'Shipping address not found:');
        throw new Error(`Shipping address not found: ${shipping_address_id}`);
    }

    // Flatten shipping address phone
    const shippingAddr = {
        ...shippingAddrData,
        phone: shippingAddrData.phone_numbers?.phone_number
    };

    const { data: billingAddrData, error: billingError } = await supabase
        .from('addresses')
        .select('*, phone_numbers(phone_number)')
        .eq('id', billing_address_id)
        .single();

    if (billingError || !billingAddrData) {
        logger.error({ err: billing_address_id, billingError }, 'Billing address not found:');
        throw new Error(`Billing address not found: ${billing_address_id}`);
    }

    // Flatten billing address phone
    const billingAddr = {
        ...billingAddrData,
        phone: billingAddrData.phone_numbers?.phone_number
    };

    // Calculate taxes with TaxEngine
    let taxResult = null;
    try {
        taxResult = TaxEngine.calculateOrderTax(cart.cart_items, shippingAddr);
        log.info('ORDER_TAX', 'Tax calculated for order', {
            taxType: taxResult.summary.taxType,
            totalTax: taxResult.summary.totalTax,
            totalAmount: taxResult.summary.totalAmount
        });
    } catch (err) {
        log.warn('ORDER_TAX_ERROR', 'Failed to calculate taxes, proceeding without', { error: err.message });
    }

    // Prepare order data for transactional RPC
    const orderData = {
        customer_name: profile.name,
        customer_email: profile.email,
        customer_phone: profile.phone || shippingAddr?.phone,
        shipping_address_id,
        billing_address_id,
        shipping_address: shippingAddr,
        total_amount: totals.finalAmount,
        subtotal: totals.totalPrice,
        coupon_code: totals.coupon?.code || null,
        coupon_discount: totals.couponDiscount || 0,
        delivery_charge: totals.deliveryCharge || 0,
        delivery_gst: totals.deliveryGST || 0,
        // Refund Metadata
        is_delivery_refundable: !(totals.deliveryCharge > 0 && (totals.globalDeliveryCharge > 0 || totals.itemBreakdown?.some(i => i.delivery_meta?.delivery_refund_policy === 'NON_REFUNDABLE'))),
        delivery_tax_type: 'GST', // System default for now
        status: 'pending', // Orders start as pending until admin/manager confirms
        payment_status: 'paid',
        notes: notes || null,
        // Tax summary - Include Delivery logic
        total_taxable_amount: (taxResult?.summary.totalTaxableAmount || 0) + (totals.deliveryCharge || 0),
        total_cgst: (taxResult?.summary.totalCgst || 0) + ((!taxResult?.summary.isInterState && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
        total_sgst: (taxResult?.summary.totalSgst || 0) + ((!taxResult?.summary.isInterState && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
        total_igst: (taxResult?.summary.totalIgst || 0) + ((taxResult?.summary.isInterState && totals.deliveryGST) ? totals.deliveryGST : 0)
    };

    // Prepare order items with tax and delivery snapshots
    const orderItems = [];
    let globalDeliveryApplied = false;
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
            const settingsService = require('./settings.service');
            const globalSettings = await settingsService.getDeliverySettings();
            const isFreeDelivery = totals.totalPrice >= (globalSettings.delivery_threshold || 0);

            const deliveryResult = await DeliveryChargeService.calculateDeliveryCharge(
                item.product_id,
                item.variant_id,
                item.quantity,
                isFreeDelivery
            );

            // If it's a global charge, only apply it to the first item that uses it
            // This mirrors the logic in DeliveryChargeService.calculateCartDelivery
            if (deliveryResult.snapshot.source === 'global') {
                if (!globalDeliveryApplied) {
                    itemDeliveryCharge = deliveryResult.deliveryCharge;
                    itemDeliveryGST = deliveryResult.deliveryGST;
                    deliverySnapshot = deliveryResult.snapshot;
                    globalDeliveryApplied = true;
                } else {
                    itemDeliveryCharge = 0;
                    itemDeliveryGST = 0;
                    deliverySnapshot = { ...deliveryResult.snapshot, base_delivery_charge: 0, applied_as_global: true };
                }
            } else {
                // Product/Variant specific charges are always applied
                itemDeliveryCharge = deliveryResult.deliveryCharge;
                itemDeliveryGST = deliveryResult.deliveryGST;
                deliverySnapshot = deliveryResult.snapshot;
            }
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
                isReturnable: product.isReturnable ?? product.is_returnable ?? true,
                price_includes_tax: variant.id
                    ? (variant.price_includes_tax ?? product.default_price_includes_tax ?? true)
                    : (product.default_price_includes_tax ?? true)
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

    logger.info({ userId, itemCount: orderItems.length, hasTax: !!taxResult }, '[Checkout] Creating order via transactional RPC');

    // ATOMIC TRANSACTION: All operations execute together or none do
    // Creates: order, order_items, payment link, admin notifications, 
    // inventory decrease, cart clear - all in one transaction
    const { data: rpcResult, error: rpcError } = await supabase
        .rpc('create_order_transactional', {
            p_user_id: userId,
            p_order_data: orderData,
            p_order_items: orderItems,
            p_payment_id: payment_id || null,
            p_cart_id: cart.id,
            p_coupon_code: totals.coupon?.code || null
        });

    if (rpcError) {
        logger.error({ err: rpcError }, '[Checkout] Transactional order creation failed:');
        throw new Error(`Order creation failed: ${rpcError.message}`);
    }

    logger.info({
        orderId: rpcResult.id,
        orderNumber: rpcResult.order_number
    }, '[Checkout] Order created successfully via transaction');

    // Prepare Presentation-Ready Order Object (Bundled for Clean UI)
    // Rule: Hide non-refundable delivery charges by bundling them into items
    let nonRefundableDeliveryTotal = 0;
    let refundableDeliveryTotal = 0;
    let nonRefundableDeliveryGST = 0;
    let refundableDeliveryGST = 0;

    const presentationItems = orderItems.map(item => {
        const snap = item.delivery_calculation_snapshot || {};
        const isRefundable = (snap.source !== 'global' && snap.delivery_refund_policy === 'REFUNDABLE');

        if (isRefundable) {
            refundableDeliveryTotal += (item.delivery_charge || 0);
            refundableDeliveryGST += (item.delivery_gst || 0);
        } else {
            nonRefundableDeliveryTotal += (item.delivery_charge || 0);
            nonRefundableDeliveryGST += (item.delivery_gst || 0);
        }
        return { ...item };
    });

    const totalToBundle = nonRefundableDeliveryTotal + nonRefundableDeliveryGST;
    if (totalToBundle > 0 && presentationItems.length > 0) {
        const currentItemsTotal = presentationItems.reduce((sum, it) => sum + (it.total_amount || 0), 0);

        presentationItems.forEach((item, index) => {
            const portion = (item.total_amount / currentItemsTotal) * totalToBundle;
            // Bundling into price_per_unit and total_amount for display
            // Note: We don't change quantity.
            item.price_per_unit = (item.price_per_unit || item.product.price) + (portion / item.quantity);
            item.total_amount += portion;
        });
    }

    // Construct order object for response and email
    const order = {
        id: rpcResult.id,
        order_number: rpcResult.order_number || rpcResult.orderNumber,
        orderNumber: rpcResult.order_number || rpcResult.orderNumber,
        status: rpcResult.status,
        totalAmount: rpcResult.totalAmount || rpcResult.total_amount,
        customerName: profile.name,
        customerEmail: profile.email,
        items: presentationItems, // Use bundled items for email/response
        // Add missing details for email template
        shippingAddress: shippingAddr,
        billingAddress: billingAddr,
        subtotal: totals.totalPrice + totalToBundle, // Subtotal absorbs non-refundable delivery
        delivery_charge: refundableDeliveryTotal, // Only show refundable delivery explicitly
        coupon_discount: totals.couponDiscount || 0,
        createdAt: new Date(),
        // Tax summary
        tax: taxResult ? {
            totalTaxableAmount: (taxResult.summary.totalTaxableAmount || 0) + (totals.deliveryCharge || 0),
            totalCgst: (taxResult.summary.totalCgst || 0) + ((!taxResult.summary.isInterState && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
            totalSgst: (taxResult.summary.totalSgst || 0) + ((!taxResult.summary.isInterState && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
            totalIgst: (taxResult.summary.totalIgst || 0) + ((taxResult.summary.isInterState && totals.deliveryGST) ? totals.deliveryGST : 0),
            totalTax: (taxResult.summary.totalTax || 0) + (totals.deliveryGST || 0),
            taxType: taxResult.summary.taxType
        } : null
    };

    // Log financial event for audit (non-blocking)
    FinancialEventLogger.logOrderCreated(order, taxResult?.summary, userId)
        .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log order creation', { error: err.message }));

    // Generate Invoice immediately for paid orders (if verified)
    // This allows including the invoice link in the confirmation email
    if (order.status === 'confirmed' || checkoutData.payment_status === 'paid') {
        try {
            const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');
            logger.info({ orderId: order.id }, '[Checkout] Generating immediate Razorpay Payment Receipt');
            // This is now purely for Payment Receipt, not the legal Tax Invoice
            const result = await InvoiceOrchestrator.generateRazorpayInvoice(order);

            if (result.success && result.invoiceUrl) {
                order.invoiceUrl = result.invoiceUrl;
                // Also update the local order object to reflect invoice status if we were returning it
                order.invoice_id = result.invoiceId;
                order.invoice_status = 'generated';
            }
        } catch (invError) {
            logger.warn({ err: invError, orderId: order.id }, '[Checkout] Failed to generate immediate invoice');
            // Continue - do not block the order response
        }
    }

    // Send Order Confirmation Email (non-transactional, OK to fail)
    logger.info({ data: profile.email }, '[CheckoutService] Sending order confirmation email to:');
    emailService.sendOrderConfirmationEmail(
        profile.email,
        {
            order: order,
            customerName: profile.name
        },
        userId
    ).catch(err => logger.error('Failed to send order confirmation email:', err));

    return order;
};

// Create admin notifications for new order
const createAdminNotifications = async (orderId) => {
    try {
        // Get all admins using JOIN with roles table
        const { data: admins, error } = await supabase
            .from('profiles')
            .select(`
                id,
                roles!inner (
                    name
                )
            `)
            .eq('roles.name', 'admin');

        if (error) {
            logger.error({ err: error }, 'Error fetching admins for notifications:');
            return;
        }

        if (!admins || admins.length === 0) {
            logger.info('No admin users found to notify');
            return;
        }

        // Create notification for each admin
        const notifications = admins.map(admin => ({
            order_id: orderId,
            admin_id: admin.id,
            status: 'unread'
        }));

        const { error: insertError } = await supabase
            .from('order_notifications')
            .insert(notifications);

        if (insertError) {
            logger.error({ err: insertError }, 'Error creating admin notifications:');
        } else {
            logger.info(`Created ${notifications.length} admin notification(s) for order ${orderId}`);
        }
    } catch (error) {
        logger.error({ err: error }, 'Unexpected error in createAdminNotifications:');
    }
};

// Handle Razorpay Webhook Events
const handleWebhookEvent = async (payload) => {
    const { event, payload: data } = payload;
    const payment = data.payment?.entity;
    const order = data.order?.entity;

    logger.info(`Processing Webhook Event: ${event} for Order: ${payment?.order_id}`);

    try {
        if (event === 'payment.captured' && payment) {
            // Payment SUCCESS
            // Find payment record by razorpay_order_id
            const { data: dbPayment, error } = await supabase
                .from('payments')
                .select('*')
                .eq('razorpay_order_id', payment.order_id)
                .single();

            if (dbPayment) {
                // Update payment status
                await updatePaymentRecord(dbPayment.id, {
                    status: 'captured',
                    razorpay_payment_id: payment.id,
                    method: payment.method,
                    updated_at: new Date().toISOString()
                });

                // Also ensure Order is marked as paid
                if (dbPayment.order_id) {
                    await supabase
                        .from('orders')
                        .update({ paymentStatus: 'paid', status: 'confirmed' })
                        .eq('id', dbPayment.order_id);
                }
            } else {
                logger.warn(`Webhook: Payment record not found for Razorpay Order ${payment.order_id}`);
            }

        } else if (event === 'payment.failed' && payment) {
            // Payment FAILED
            const { data: dbPayment } = await supabase
                .from('payments')
                .select('*')
                .eq('razorpay_order_id', payment.order_id) // Razorpay usually sends order_id even on fail
                .single();

            if (dbPayment) {
                await updatePaymentRecord(dbPayment.id, {
                    status: 'failed',
                    error_description: payment.error_description || 'Payment Failed via Webhook',
                    updated_at: new Date().toISOString()
                });

                // If order exists, mark as pending payment or cancelled?
                // Usually keep as 'created' or 'pending_payment'
            }
        } else if (event === 'refund.processed' && data.refund) {
            // Refund Processed
            const refund = data.refund.entity;
            const { data: dbPayment } = await supabase
                .from('payments')
                .select('*')
                .eq('razorpay_payment_id', refund.payment_id)
                .single();

            if (dbPayment) {
                await updatePaymentRecord(dbPayment.id, {
                    status: 'refunded', // or partial_refunded
                    refund_id: refund.id,
                    refund_status: refund.status,
                    updated_at: new Date().toISOString()
                });

                if (dbPayment.order_id) {
                    await supabase
                        .from('orders')
                        .update({ paymentStatus: 'refunded', status: 'refunded' })
                        .eq('id', dbPayment.order_id);

                    // Add timeline entry for refund completion
                    const refundAmount = refund.amount ? (refund.amount / 100).toFixed(2) : 'N/A';
                    await supabase
                        .from('order_status_history')
                        .insert({
                            order_id: dbPayment.order_id,
                            status: 'refunded',
                            updated_by: null, // System action
                            notes: `Refund Completed: ₹${refundAmount} credited to your account (Refund ID: ${refund.id})`,
                            created_at: new Date().toISOString()
                        });

                    logger.info(`[Webhook] Refund completed for order ${dbPayment.order_id}, Refund ID: ${refund.id}`);
                }
            }
        }
    } catch (error) {
        logger.error({ err: error }, 'Error handling webhook event:');
        throw error; // Rethrow to let webhook route know? No, usually return 200 OK so Razorpay doesn't retry infinitely if it's our logic bug.
    }
};

// Process Refund (Server-Side)
const processRefund = async (paymentId, amount = null) => {
    try {
        logger.info(`[Refund] Starting refund process for payment_id: ${paymentId}`);

        // Get payment record
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (error) {
            logger.error(`[Refund] Database error finding payment:`, error);
            throw new Error(`Payment record not found: ${error.message}`);
        }

        if (!payment) {
            logger.error(`[Refund] Payment record not found for id: ${paymentId}`);
            throw new Error('Payment record not found');
        }

        logger.info(`[Refund] Found payment record:`, {
            id: payment.id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_order_id: payment.razorpay_order_id,
            status: payment.status,
            amount: payment.amount
        });

        // Validate Razorpay payment ID exists
        if (!payment.razorpay_payment_id) {
            logger.error(`[Refund] No razorpay_payment_id found on payment record. Razorpay refund cannot be processed.`);
            throw new Error('No Razorpay payment ID found - refund cannot be processed. Payment may not have been captured.');
        }

        // Only process refund if payment was actually captured
        if (payment.status !== 'captured' && payment.status !== 'paid') {
            logger.warn(`[Refund] Payment status is "${payment.status}", not "captured". Skipping Razorpay refund.`);
            // Update order payment status to indicate refund not needed
            return { skipped: true, reason: `Payment status is ${payment.status}` };
        }

        // Razorpay SDK: payments.refund(paymentId, options?)
        // paymentId is the first argument, NOT inside options
        const razorpayPaymentId = payment.razorpay_payment_id;
        const refundOptions = {};
        if (amount) {
            refundOptions.amount = Math.round(amount * 100); // Amount in paise
        }

        logger.info(`[Refund] Calling Razorpay refund API: paymentId=${razorpayPaymentId}, options=`, refundOptions);
        const refund = await razorpay.payments.refund(razorpayPaymentId, refundOptions);
        logger.info(`[Refund] Razorpay refund successful:`, refund);

        // Update DB - only update status (refund details already logged above)
        await updatePaymentRecord(paymentId, {
            status: 'refunded'
        });

        return refund;
    } catch (error) {
        logger.error('[Refund] Refund failed:', {
            message: error.message,
            statusCode: error.statusCode,
            error: error.error,
            description: error.description
        });
        throw new Error(`Failed to process refund: ${error.message || 'Unknown error'}`);
    }
};

/**
 * Process payment verification and create order
 * Encapsulates the entire checkout completion flow
 * 
 * AUTO CAPTURE PATTERN:
 * 1. Verify payment signature
 * 2. Payment is ALREADY CAPTURED
 * 3. Run DB transaction (order creation)
 * 4. If DB succeeds → All good
 * 5. If DB fails → REFUND payment
 */
async function processPaymentAndOrder(userId, {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    payment_id,
    shipping_address_id,
    billing_address_id,
    notes
}) {
    const trace = getTraceContext();
    log.operationStart('PROCESS_PAYMENT_ORDER', {
        userId,
        razorpayOrderId: razorpay_order_id,
        hasPaymentId: !!payment_id
    });
    const startTime = Date.now();

    // Check if this is a mock payment (for testing)
    const isMockPayment = razorpay_order_id.startsWith('mock_');

    // Get cart totals for capture amount
    const cart = await getUserCart(userId);
    const totals = await calculateCartTotals(userId, cart);
    const captureAmount = totals.finalAmount;

    log.debug('PROCESS_PAYMENT_ORDER', 'Cart loaded', {
        itemCount: cart.cart_items?.length,
        captureAmount
    });

    // Verify payment signature (skip for mock payments)
    if (!isMockPayment) {
        const isValid = verifyRazorpayPayment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            logger.warn({
                razorpay_payment_id,
                razorpay_order_id,
                received_signature: razorpay_signature
            }, 'Signature verification failed. Attempting S2S verification.');

            try {
                // Server-to-Server Verification (Source of Truth)
                const payment = await razorpay.payments.fetch(razorpay_payment_id);

                logger.info({
                    fetched_order_id: payment.order_id,
                    expected_order_id: razorpay_order_id,
                    status: payment.status
                }, 'S2S Payment Fetched');

                // Check 1: Is payment successful?
                if (payment.status !== 'captured' && payment.status !== 'authorized') {
                    throw new Error(`Payment status is ${payment.status} (not captured)`);
                }

                // Check 2: Does Order ID match?
                // If we didn't have an order_id (nullish), we accept the one from payment
                // If we did have one, it must match
                if (razorpay_order_id && payment.order_id !== razorpay_order_id) {
                    // MISMATCH: User paid for Order A, but trying to verify Order B.
                    // We must REFUND this payment to be safe.
                    logger.warn('Order ID mismatch in S2S check. Initiating Refund.');
                    throw new Error(`Order ID mismatch: Payment is for ${payment.order_id}, expected ${razorpay_order_id}`);
                }

                // If we are here, S2S is valid!
                // We can proceed. We trust Razorpay API more than client signature.
                logger.info('S2S verification passed. Proceeding with order creation.');

                // Update our local variable if needed (for consistency in DB)
                // razorpay_order_id = payment.order_id; // (const, can't reassign, but downstream uses it?)
                // processPaymentAndOrder uses destructuring, so we can't easily change `razorpay_order_id` variable without let.
                // However, the DB transaction uses `razorpay_order_id` from the scope? 
                // No, it uses `payment_id` record.
                // We should ensure the payment record is updated with correct Razorpay IDs.

                if (payment_id) {
                    await updatePaymentRecord(payment_id, {
                        razorpay_payment_id,
                        razorpay_signature: 's2s_verified', // Mark as S2S verified
                        status: 'captured',
                        razorpay_order_id: payment.order_id // Ensure correct order ID is stored
                    });
                }

            } catch (s2sError) {
                // S2S Failed or Mismatch -> REFUND
                logger.error({ err: s2sError }, 'S2S Verification Failed.');

                // Attempt Auto-Refund if payment was captured
                try {
                    const payment = await razorpay.payments.fetch(razorpay_payment_id);
                    if (payment.status === 'captured' || payment.status === 'authorized') {
                        logger.info('Auto-Refunding failed/mismatched payment...');
                        await razorpay.payments.refund(razorpay_payment_id, {
                            reason: `Validation/Verification Failed: ${s2sError.message}`
                        });

                        if (payment_id) {
                            await updatePaymentRecord(payment_id, { status: 'refunded', error_description: s2sError.message });
                        }

                        const refundError = new Error('Payment verification failed and your amount has been refunded. Please try again.');
                        refundError.status = 400;
                        throw refundError;
                    }
                } catch (refundErr) {
                    // Start of refund error handling (if refund fails, or if it was thrown above)
                    if (refundErr.message.includes('has been refunded')) throw refundErr;
                }

                // Update payment as failed
                if (payment_id) {
                    await updatePaymentRecord(payment_id, {
                        status: 'failed',
                        error_description: s2sError.message || 'Invalid payment signature'
                    });
                }
                const error = new Error('Invalid payment signature and verification failed.');
                error.status = 400;
                throw error;
            }
        }

        // --- PAYMENT SIGNATURE VERIFIED ---
        // Payment is ALREADY CAPTURED (Auto-Capture)
        // Update payment record to 'captured'
        if (payment_id) {
            await updatePaymentRecord(payment_id, {
                razorpay_payment_id,
                razorpay_signature,
                status: 'captured' // It is already captured!
            });
        }

        logger.info({
            razorpay_payment_id,
            razorpay_order_id,
            amount: captureAmount
        }, '[Checkout] Payment signature verified (Auto-captured), proceeding with order creation');

        // Send Payment Confirmation Email (async, don't await)
        // Fetch user email if not available in scope (we have userId)
        const { data: userProfile } = await supabase.from('profiles').select('email, name').eq('id', userId).single();
        if (userProfile?.email) {
            const emailService = require('./email'); // Lazy load to avoid circular deps if any
            emailService.send('PAYMENT_CONFIRMED', userProfile.email, {
                customerName: userProfile.name,
                order: { id: razorpay_order_id, orderNumber: razorpay_order_id }, // We don't have our internal order ID yet, use Razorpay Order ID for ref
                paymentId: razorpay_payment_id,
                amount: captureAmount,
                method: 'razorpay'
            }, userId).catch(err => logger.error({ err }, 'Failed to send payment confirmation email'));
        }

    } else {
        logger.info('Processing mock payment for testing...');
        // For mock payments, ensure record is updated if exists
        if (payment_id) {
            try {
                await updatePaymentRecord(payment_id, {
                    razorpay_payment_id,
                    razorpay_signature,
                    status: 'captured' // Mock payments are auto-captured
                });
            } catch (error) {
                logger.info('Mock payment record not found, proceeding without it');
            }
        }
    }

    // --- PAYMENT ID RECOVERY ---
    // If frontend failed to pass payment_id (e.g. old code or bug), try to find it via Razorpay Order ID
    if (!payment_id && razorpay_order_id) {
        try {
            const { data: existingPayment } = await supabase
                .from('payments')
                .select('id')
                .eq('razorpay_order_id', razorpay_order_id)
                .single();

            if (existingPayment) {
                payment_id = existingPayment.id;
                logger.info({ recovered_payment_id: payment_id }, 'Recovered missing payment_id via razorpay_order_id');
            }
        } catch (e) {
            // Log warning but proceed - this is a recovery attempt, not critical path
            logger.warn({ err: e, razorpay_order_id }, 'Failed to recover payment_id via razorpay_order_id');
        }
    }

    // --- DB TRANSACTION PHASE ---
    try {
        // Create order via atomic PostgreSQL transaction
        const order = await createOrder(
            userId,
            {
                shipping_address_id,
                billing_address_id,
                payment_id,
                notes,
                payment_status: 'paid'
            },
            cart
        );

        // Log functionality for Timeline (Fix for missing history)
        const { logStatusHistory } = require('./order.service');
        await logStatusHistory(order.id, 'pending', userId, 'Order placed successfully');

        // --- DB SUCCESS ---
        // Payment was already captured, so we don't need to do anything else.
        logger.info({
            razorpay_payment_id,
            orderId: order.id
        }, '[Checkout] Order created successfully. Payment already captured.');

        return {
            success: true,
            order: {
                id: order.id,
                orderNumber: order.orderNumber || order.order_number,
                totalAmount: order.totalAmount || order.total_amount,
                status: order.status
            }
        };

    } catch (systemError) {
        // --- DB FAILURE: REFUND PAYMENT ---
        logger.error({
            err: systemError,
            razorpay_payment_id,
            razorpay_order_id,
            userId
        }, '[Checkout] Order creation failed. Initiating REFUND.');

        // Only refund if we have a real (non-mock) payment
        if (!isMockPayment && razorpay_payment_id) {
            try {
                // Use RefundService for TECHNICAL_REFUND (100% amount)
                if (payment_id) {
                    await RefundService.asyncProcessRefund(payment_id, REFUND_TYPES.TECHNICAL_REFUND, 'SYSTEM', `Order creation failed: ${systemError.message}`, true);
                } else {
                    // Fallback for extreme cases where even internal payment_id is missing but we have RP ID
                    const { refundPayment } = require('../utils/razorpay-helper');
                    await refundPayment(razorpay_payment_id, null, {
                        reason: `Order creation failed: ${systemError.message}`
                    });
                }

                // Update payment record to refunded
                if (payment_id) {
                    await updatePaymentRecord(payment_id, {
                        status: 'refunded',
                        error_description: 'Order creation failed - payment refunded'
                    });
                }

                logger.info({
                    razorpay_payment_id,
                    razorpay_order_id
                }, '[Checkout] Payment refunded successfully');

                const userError = new Error(`Order creation failed (${systemError.message}) and payment has been refunded. Please try again.`);
                userError.status = 500;
                throw userError;

            } catch (refundError) {
                // Check if this is our intentional re-throw
                if (refundError.message.includes('Order creation failed')) {
                    throw refundError;
                }

                logger.error({
                    err: refundError,
                    razorpay_payment_id,
                    razorpay_order_id
                }, '[Checkout] CRITICAL: Failed to refund payment after DB failure!');

                const userError = new Error('Order creation failed. We encountered an issue refunding your payment. Please contact support immediately.');
                userError.status = 500;
                throw userError;
            }
        } else {
            // Mock payment or no payment ID - just re-throw the original error
            throw systemError;
        }
    }
}

/**
 * Process Buy Now Order
 * Creates an order for a single item without using the cart
 */
const processBuyNowOrder = async (userId, paymentData, buyNowData) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_id,
        shipping_address_id,
        billing_address_id,
        notes
    } = paymentData;

    const { productId, variantId, quantity = 1 } = buyNowData;

    log.info('BUY_NOW_START', 'Processing Buy Now order', { userId, productId, variantId, quantity });

    // Verify payment signature
    const isValidSignature = verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValidSignature) {
        log.error('BUY_NOW_INVALID_SIGNATURE', 'Invalid payment signature');
        const error = new Error('Payment verification failed. Please contact support if money was deducted.');
        error.status = 400;
        throw error;
    }

    // Update payment record
    if (payment_id) {
        await updatePaymentRecord(payment_id, {
            razorpay_payment_id,
            razorpay_signature,
            status: 'captured'
        });
    }

    try {
        // Fetch product
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            const error = new Error('This product is no longer available.');
            error.status = 404;
            throw error;
        }

        // Fetch variant if provided
        let variant = null;
        if (variantId) {
            const { data: v } = await supabase
                .from('product_variants')
                .select('*')
                .eq('id', variantId)
                .single();
            variant = v;
        }

        // Check stock
        const stockCheck = await checkStockAvailability([{
            product_id: productId,
            variant_id: variantId,
            quantity,
            products: product,
            product_variants: variant
        }]);

        if (!stockCheck.available) {
            const error = new Error(`Sorry, "${product.title}" is currently out of stock. Your payment will be refunded.`);
            error.status = 400;
            throw error;
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, phone')
            .eq('id', userId)
            .single();

        if (!profile) {
            const error = new Error('Please complete your profile before placing an order.');
            error.status = 400;
            throw error;
        }

        // Get addresses
        const { data: shippingAddrData } = await supabase
            .from('addresses')
            .select('*, phone_numbers(phone_number)')
            .eq('id', shipping_address_id)
            .single();

        if (!shippingAddrData) {
            const error = new Error('Shipping address not found. Please add an address to continue.');
            error.status = 400;
            throw error;
        }

        const shippingAddr = {
            ...shippingAddrData,
            phone: shippingAddrData.phone_numbers?.phone_number
        };

        const { data: billingAddrData } = await supabase
            .from('addresses')
            .select('*, phone_numbers(phone_number)')
            .eq('id', billing_address_id)
            .single();

        const billingAddr = billingAddrData ? {
            ...billingAddrData,
            phone: billingAddrData.phone_numbers?.phone_number
        } : shippingAddr;

        // Calculate totals
        const unitPrice = variant?.selling_price || product.price;
        const unitMrp = variant?.mrp || product.mrp || unitPrice;
        const subtotal = unitPrice * quantity;

        // Fetch delivery settings and calculate charge via Service
        const { DeliveryChargeService } = require('./delivery-charge.service');
        const settingsService = require('./settings.service');
        const globalSettings = await settingsService.getDeliverySettings();

        // Determine isFreeDelivery based on threshold
        const isFreeDelivery = subtotal >= (globalSettings.delivery_threshold || 0);

        const deliveryResult = await DeliveryChargeService.calculateDeliveryCharge(
            productId,
            variantId,
            quantity,
            isFreeDelivery
        );

        const deliveryCharge = deliveryResult.deliveryCharge;
        const deliveryGST = deliveryResult.deliveryGST;
        const totalAmount = subtotal + deliveryResult.totalDelivery;

        // Build virtual cart item for tax calculation
        const virtualCartItem = {
            product_id: productId,
            variant_id: variantId,
            quantity,
            products: product,
            product_variants: variant
        };

        // Calculate taxes
        let taxResult = null;
        try {
            taxResult = TaxEngine.calculateOrderTax([virtualCartItem], shippingAddr);
        } catch (err) {
            log.warn('BUY_NOW_TAX_ERROR', 'Failed to calculate taxes', { error: err.message });
        }

        // Prepare order data
        const orderData = {
            customer_name: profile?.name,
            customer_email: profile?.email,
            customer_phone: profile?.phone || shippingAddr?.phone,
            shipping_address_id,
            billing_address_id,
            shipping_address: shippingAddr,
            total_amount: totalAmount,
            subtotal,
            coupon_code: null,
            coupon_discount: 0,
            delivery_charge: deliveryCharge,
            delivery_gst: deliveryGST, // Add missing delivery GST field
            is_delivery_refundable: !(deliveryCharge > 0 && deliveryResult.snapshot?.delivery_refund_policy === 'NON_REFUNDABLE'),
            delivery_tax_type: 'GST',
            status: 'pending',
            payment_status: 'paid',
            notes: notes || 'Buy Now Order',
            // Tax summary including delivery
            total_taxable_amount: (taxResult?.summary.totalTaxableAmount || 0) + deliveryCharge,
            total_cgst: (taxResult?.summary.totalCgst || 0) + ((!taxResult?.summary.isInterState && deliveryGST) ? (deliveryGST / 2) : 0),
            total_sgst: (taxResult?.summary.totalSgst || 0) + ((!taxResult?.summary.isInterState && deliveryGST) ? (deliveryGST / 2) : 0),
            total_igst: (taxResult?.summary.totalIgst || 0) + ((taxResult?.summary.isInterState && deliveryGST) ? deliveryGST : 0)
        };

        // Prepare order item
        const taxBreakdown = taxResult?.items[0]?.taxBreakdown || {};
        const orderItems = [{
            product_id: productId,
            variant_id: variantId,
            quantity,
            product: {
                id: product.id,
                title: product.title,
                price: unitPrice,
                images: product.images || [],
                isReturnable: product.isReturnable ?? product.is_returnable ?? true
            },
            delivery_charge: deliveryCharge,
            delivery_gst: deliveryGST, // Add delivery GST
            delivery_calculation_snapshot: deliveryResult.snapshot, // Add snapshot
            coupon_id: null,
            coupon_code: null,
            coupon_discount: 0,
            taxable_amount: taxBreakdown.taxableAmount || null,
            cgst: taxBreakdown.cgst || 0,
            sgst: taxBreakdown.sgst || 0,
            igst: taxBreakdown.igst || 0,
            hsn_code: taxBreakdown.hsnCode || null,
            gst_rate: taxBreakdown.gstRate || null,
            total_amount: taxBreakdown.totalAmount || null,
            variant_snapshot: variant ? {
                variant_id: variant.id,
                size_label: variant.size_label,
                selling_price: variant.selling_price,
                mrp: variant.mrp,
                description: variant.description,
                tax_applicable: variant.tax_applicable || false,
                price_includes_tax: variant.price_includes_tax ?? true
            } : null
        }];

        log.info('BUY_NOW_CREATE_ORDER', 'Creating Buy Now order via RPC', { userId, itemCount: 1 });

        // Use transactional RPC (skip cart clearing since we're not using cart)
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('create_order_transactional', {
                p_user_id: userId,
                p_order_data: orderData,
                p_order_items: orderItems,
                p_cart_id: null, // No cart to clear
                p_payment_id: payment_id,
                p_coupon_code: null
            });

        if (rpcError) {
            log.error('BUY_NOW_RPC_ERROR', 'Buy Now order creation failed', { error: rpcError.message });
            throw rpcError;
        }

        const order = rpcResult;

        // Log functionality for Timeline (Fix for missing history)
        const { logStatusHistory } = require('./order.service');
        await logStatusHistory(order.id, 'pending', userId, 'Order placed successfully');

        log.info('BUY_NOW_SUCCESS', 'Buy Now order created successfully', { orderId: order?.id });

        // Generate Invoice immediately after successful RPC (since payment is already verified/paid)
        try {
            const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');
            log.info({ orderId: order.id }, 'Generating immediate Razorpay Payment Receipt for Buy Now');
            const result = await InvoiceOrchestrator.generateRazorpayInvoice({
                ...order,
                customer_name: profile.name,
                customer_email: profile.email,
                customer_phone: profile.phone || shippingAddr?.phone,
                items: orderItems,
                shippingAddress: shippingAddr,
                billingAddress: billingAddr,
                subtotal,
                delivery_charge: deliveryCharge,
                delivery_gst: deliveryGST,
                coupon_discount: 0
            });

            if (result.success && result.invoiceUrl) {
                order.invoiceUrl = result.invoiceUrl;
            }
        } catch (invError) {
            log.warn('BUY_NOW_INVOICE_ERROR', 'Failed to generate immediate invoice', { error: invError.message });
        }

        // Send confirmation email
        try {
            await emailService.sendOrderConfirmationEmail(
                profile.email,
                {
                    order: order,
                    customerName: profile.name
                },
                userId
            );
        } catch (emailErr) {
            log.warn('BUY_NOW_EMAIL_ERROR', 'Failed to send confirmation email', { error: emailErr.message });
        }

        return {
            success: true,
            order: {
                id: order.id,
                orderNumber: order.orderNumber || order.order_number,
                totalAmount: order.totalAmount || order.total_amount,
                status: order.status
            }
        };

    } catch (error) {
        log.error('BUY_NOW_ERROR', 'Buy Now order failed', { error: error.message });

        // Refund payment if order creation failed
        if (razorpay_payment_id) {
            try {
                // Use RefundService for TECHNICAL_REFUND (100% amount)
                if (payment_id) {
                    await RefundService.asyncProcessRefund(payment_id, REFUND_TYPES.TECHNICAL_REFUND, 'SYSTEM', `Buy Now order failed: ${error.message}`, true);
                } else {
                    const { refundPayment } = require('../utils/razorpay-helper');
                    await refundPayment(razorpay_payment_id, null, {
                        reason: `Buy Now order failed: ${error.message}`
                    });
                }

                if (payment_id) {
                    await updatePaymentRecord(payment_id, {
                        status: 'refunded',
                        error_description: 'Buy Now order failed - payment refunded'
                    });
                }

                const userError = new Error('Order creation failed and payment has been refunded. Please try again.');
                userError.status = 500;
                throw userError;
            } catch (refundError) {
                if (refundError.message.includes('Order creation failed')) {
                    throw refundError;
                }
                log.error('BUY_NOW_REFUND_ERROR', 'Failed to refund payment', { error: refundError.message });
                const criticalError = new Error('Order failed and we encountered an issue processing your refund. Please contact support immediately with your payment ID.');
                criticalError.status = 500;
                throw criticalError;
            }
        }

        throw error;
    }
};

module.exports = {
    getCheckoutSummary,
    createRazorpayInvoice,
    verifyRazorpayPayment,
    createPaymentRecord,
    updatePaymentRecord,
    createOrder,
    processPaymentAndOrder,
    processBuyNowOrder,
    handleWebhookEvent,
    processRefund
};

