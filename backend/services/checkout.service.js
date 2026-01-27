const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { calculateCartTotals, getUserCart, removeFromCart } = require('./cart.service');
const { getPrimaryAddress, getLatestAddress, getAddressById, getUserAddresses } = require('./address.service');
const { checkStockAvailability, decreaseInventory } = require('./inventory.service');
const emailService = require('./email');
const { RefundService, REFUND_TYPES } = require('./refund.service');
const { capturePayment, voidAuthorization, refundPayment } = require('../utils/razorpay-helper');
// Tax and Pricing
const { TaxEngine } = require('./tax-engine.service');
const { PricingCalculator } = require('./pricing-calculator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const { logStatusHistory } = require('./history.service');
const { validateCoupon } = require('./coupon.service');
const { RazorpayInvoiceService } = require('./razorpay-invoice.service');
const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');
const { wrapRazorpayWithTimeout } = require('../utils/razorpay-timeout');
const { ORDER_STATUS, PAYMENT_STATUS, RAZORPAY_STATUS } = require('../config/constants');
const MESSAGES = require('../config/messages');

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

const razorpayRaw = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});

// Wrap Razorpay with timeout protection (30s default, configurable via RAZORPAY_API_TIMEOUT)
const razorpay = wrapRazorpayWithTimeout(razorpayRaw);


/**
 * Create a virtual cart for Buy Now, merging with user's existing cart items if present
 */
const createBuyNowVirtualCart = async (userId, guestId, buyNowData) => {
    const { productId, variantId, quantity = 1 } = buyNowData;

    // 1. Fetch Product & Variant Details
    const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (!product) {
        const error = new Error(MESSAGES.CHECKOUT.PRODUCT_NOT_FOUND);
        error.status = 404;
        throw error;
    }

    let variant = null;
    if (variantId) {
        const { data: v } = await supabase
            .from('product_variants')
            .select('*')
            .eq('id', variantId)
            .single();
        variant = v;
        variant = v;
        if (!variant) {
            const error = new Error(MESSAGES.CHECKOUT.VARIANT_NOT_FOUND);
            error.status = 404;
            throw error;
        }
    }

    // 2. CRITICAL: Check stock availability before proceeding
    const stockCheck = await checkStockAvailability([{
        product_id: productId,
        variant_id: variantId,
        quantity: quantity
    }]);

    if (!stockCheck.available) {
        const error = new Error(MESSAGES.CHECKOUT.INSUFFICIENT_STOCK);
        error.status = 400;
        error.stockInfo = stockCheck;
        throw error;
    }

    // 3. Use exact Buy Now quantity - do not merge with cart
    // Buy Now intent is "purchase THIS item NOW", not "purchase this + cart items"
    const finalQuantity = quantity;

    // 4. Construct Virtual Cart
    return {
        id: 'buy-now-virtual', // Use null when creating order to prevent DB updates
        user_id: userId,
        guest_id: guestId,
        applied_coupon_code: buyNowData.couponCode || null, // Support coupon codes in Buy Now
        cart_items: [
            {
                product_id: productId,
                variant_id: variantId || (variant ? variant.id : null),
                quantity: finalQuantity,
                products: product,
                product_variants: variant,
                id: `buynow-${productId}-${variantId || 'def'}`
            }
        ]
    };
};

// Get checkout summary (cart + addresses + totals + tax + profile)
// PHASE 3A: Now includes user_profile to eliminate duplicate fetch in payment creation
const getCheckoutSummary = async (userId, guestId, addressId = null) => {
    // 1. Fetch Cart First
    const cart = await getUserCart(userId, guestId);
    if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
        return { cart: null, totals: null, shipping_address: null, billing_address: null };
    }

    // 2. Fetch dependencies in parallel
    const [profileResult, allAddresses] = await Promise.all([
        userId ? supabase.from('profiles').select('*').eq('id', userId).single() : Promise.resolve({ data: null }),
        userId ? getUserAddresses(userId) : Promise.resolve([])
    ]);
    const profile = profileResult.data;

    // 3. Resolve Addresses
    const findAddressByType = (addresses, type) => {
        const primary = addresses.find(a => a.is_primary && (a.type === type || a.type === 'both'));
        if (primary) return primary;
        return addresses.find(a => a.type === type || a.type === 'both');
    };

    let shippingAddress = null;
    if (addressId) {
        shippingAddress = allAddresses.find(a => a.id === addressId);
    }

    if (!shippingAddress) {
        // Fallback sequence: Primary Shipping -> Any Shipping -> Any Primary -> First Available
        shippingAddress = allAddresses.find(a => a.is_primary && (a.type === 'shipping' || a.type === 'both')) ||
            findAddressByType(allAddresses, 'shipping') ||
            allAddresses.find(a => a.is_primary) ||
            allAddresses[0];
    }

    // Validate completeness
    if (shippingAddress) {
        const requiredFields = ['name', 'street', 'city', 'state', 'zip_code', 'phone'];
        const isIncomplete = requiredFields.some(field => !shippingAddress[field]);
        if (isIncomplete) {
            log.warn('SUMMARY_INCOMPLETE_ADDR', 'Shipping address incomplete, unsetting', { addressId: shippingAddress.id });
            shippingAddress = null;
        }
    }

    const billingAddress = findAddressByType(allAddresses, 'billing') ||
        allAddresses.find(a => a.is_primary) ||
        allAddresses[0] ||
        shippingAddress;

    // 4. Calculate Totals once using the RESOLVED address
    // This ensures consistency between the displayed totals and the active address
    const totals = await calculateCartTotals(userId, guestId, cart, {
        addressId: shippingAddress?.id || null
    });

    // 5. Construct Response
    // We map the totals.tax and itemBreakdown to the interface expected by the Frontend
    const response = {
        cart,
        totals,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        user_profile: profile,
        tax: totals.tax ? {
            total_tax: totals.tax.amount,
            total_taxable_amount: totals.itemsCount > 0 ? totals.totalPrice - totals.tax.amount : 0,
            total_cgst: totals.tax.cgst || 0,
            total_sgst: totals.tax.sgst || 0,
            total_igst: totals.tax.igst || 0,
            tax_type: totals.tax.type,
            items: (totals.itemBreakdown || []).map(item => ({
                product_id: item.product_id,
                variant_id: item.variant_id,
                taxable_amount: item.tax_breakdown?.taxable_amount || 0,
                cgst: item.tax_breakdown?.cgst || 0,
                sgst: item.tax_breakdown?.sgst || 0,
                igst: item.tax_breakdown?.igst || 0,
                total_tax: item.tax_breakdown?.total_tax || 0,
                gst_rate: item.tax_breakdown?.gst_rate || 0
            }))
        } : null
    };

    return response;
};

// Create Razorpay INVOICE (replaces simple Order)
// This generates a detailed PDF Invoice + Email
const createRazorpayInvoice = async (amount, receipt, customer, lineItems, totals = null) => {
    log.operationStart('CREATE_RAZORPAY_INVOICE', { amount, receipt });
    const startTime = Date.now();

    try {
        // Prepare Product Line Items (Strictly Products)
        // We filter out any existing delivery or discount items if passed (safeguard)
        const productItems = lineItems.filter(item =>
            !['Standard Delivery (Non-Ref)', 'Refundable Surcharge', 'Addt. Processing (Non-Ref)', 'Coupon Discount'].includes(item.name)
        ).map(item => {
            const { deliveryCharge, deliveryGST, deliveryGSTRate, ...rest } = item;
            return rest;
        });

        // Identify and Aggregated Delivery Charges (Transparency)
        const deliveryAggregator = {};

        if (totals) {
            // Priority 1: Use totals for high accuracy
            if (totals.globalDeliveryCharge > 0) {
                const label = 'Standard Delivery (Non-Ref)';
                const totalGlobal = totals.globalDeliveryCharge + (totals.globalDeliveryGST || 0);
                deliveryAggregator[label] = (deliveryAggregator[label] || 0) + totalGlobal;

                // Debug logging
                logger.info({
                    receipt,
                    globalDeliveryCharge: totals.globalDeliveryCharge,
                    globalDeliveryGST: totals.globalDeliveryGST,
                    totalGlobal
                }, '[Checkout] Added Standard Delivery to invoice');
            }

            if (totals.productDeliveryCharges > 0) {
                let refundableSurcharge = 0;
                let nonRefundableSurcharge = 0;

                (totals.itemBreakdown || []).forEach(item => {
                    const total = (item.delivery_charge || 0) + (item.delivery_gst || 0);
                    if (total > 0 && item.delivery_meta?.source !== 'global') {
                        const isRefundable = (item.delivery_meta?.delivery_refund_policy === 'REFUNDABLE');
                        const label = isRefundable ? 'Refundable Surcharge' : 'Addt. Processing (Non-Ref)';
                        deliveryAggregator[label] = (deliveryAggregator[label] || 0) + total;

                        // Track for logging
                        if (isRefundable) {
                            refundableSurcharge += total;
                        } else {
                            nonRefundableSurcharge += total;
                        }
                    }
                });

                // Debug logging
                if (refundableSurcharge > 0 || nonRefundableSurcharge > 0) {
                    logger.info({
                        receipt,
                        refundableSurcharge,
                        nonRefundableSurcharge,
                        totalProductSurcharges: totals.productDeliveryCharges,
                        itemBreakdownCount: (totals.itemBreakdown || []).length
                    }, '[Checkout] Added Product Surcharges to invoice');
                }
            }

            // Log final delivery aggregation
            const deliveryLineCount = Object.keys(deliveryAggregator).length;
            if (deliveryLineCount > 0) {
                logger.info({
                    receipt,
                    deliveryLines: deliveryAggregator,
                    lineCount: deliveryLineCount
                }, '[Checkout] Final delivery aggregation for Razorpay invoice');
            }
        } else {
            // Fallback: Legacy extraction from metadata (Buy Now or older callers)
            const firstItem = lineItems[0] || {};
            if (firstItem.deliveryCharge !== undefined) {
                const base = firstItem.deliveryCharge || 0;
                const gst = firstItem.deliveryGST || 0;
                const total = base + gst;
                if (total > 0) {
                    deliveryAggregator['Standard Delivery (Non-Ref)'] = total;
                }
            }
        }

        // Final Line Items
        const cleanLineItems = [...productItems];



        // Apply Coupon Discount using PRECISE breakdown from Pricing Engine calculator
        // This ensures Product vs Variant vs Cart coupons are applied exactly as per business logic
        const discountVal = (totals?.couponDiscount || 0);
        const itemBreakdown = totals?.itemBreakdown || [];

        if (discountVal > 0 && cleanLineItems.length > 0) {

            // Strategy: Use precise discount from itemBreakdown if available (Preferred)
            // Fallback: Proportional distribution (Legacy/Safety)

            let preciseDiscountApplied = 0;
            let appliedPreciseLogic = false;

            if (itemBreakdown.length > 0) {
                cleanLineItems.forEach(item => {
                    // Find matching item in breakdown using ID
                    // We check variantId first (most specific), then productId
                    const breakdownItem = itemBreakdown.find(bi => {
                        if (item.variantId && bi.variant_id) {
                            return bi.variant_id === item.variantId;
                        }
                        return bi.product_id === item.productId && !bi.variant_id; // Match product-only items
                    });

                    if (breakdownItem && breakdownItem.coupon_discount > 0) {
                        const originalAmount = item.amount; // In Paise
                        const discountInPaise = Math.round(breakdownItem.coupon_discount * 100);

                        // Ensure we don't discount more than the item price
                        const finalDiscount = Math.min(discountInPaise, originalAmount);

                        item.amount = originalAmount - finalDiscount;
                        preciseDiscountApplied += finalDiscount;
                        appliedPreciseLogic = true;
                    }
                });
            }

            if (appliedPreciseLogic) {
                logger.info({
                    receipt,
                    discountVal,
                    preciseDiscountApplied: preciseDiscountApplied / 100
                }, '[Checkout] Applied PRECISE coupon discounts from PricingEngine');
            } else {
                // FALLBACK: Proportional Logic (for old carts or missing breakdown)
                // Calculate total before discount (PRODUCTS ONLY)
                const totalBeforeDiscount = cleanLineItems.reduce((sum, item) => sum + item.amount, 0); // Paise
                const discountInPaise = Math.round(discountVal * 100);

                // Safety: Constraint discount to product total
                const effectiveDiscountInPaise = Math.min(discountInPaise, totalBeforeDiscount);
                const targetTotal = totalBeforeDiscount - effectiveDiscountInPaise;
                const discountFactor = effectiveDiscountInPaise / totalBeforeDiscount;

                let runningTotal = 0;

                cleanLineItems.forEach((item, index) => {
                    const originalAmount = item.amount;
                    if (index === cleanLineItems.length - 1) {
                        const newAmount = Math.max(0, targetTotal - runningTotal);
                        item.amount = newAmount;
                    } else {
                        const itemDiscount = Math.round(originalAmount * discountFactor);
                        item.amount = originalAmount - itemDiscount;
                        runningTotal += item.amount;
                    }
                });

                logger.info({
                    receipt,
                    totalBeforeDiscount,
                    effectiveDiscountInPaise
                }, '[Checkout] Applied PROPORTIONAL (Fallback) coupon discounts');
            }
        }

        // Sanitize Line Items (Remove internal IDs before sending to Razorpay)
        cleanLineItems.forEach(item => {
            delete item.productId;
            delete item.variantId;
        });

        // NOW Add Aggregated Delivery Charges (Un-discounted)
        Object.entries(deliveryAggregator).forEach(([name, amount]) => {
            cleanLineItems.push({
                name: name,
                amount: Math.round(amount * 100),
                currency: 'INR',
                quantity: 1
            });
        });

        // Construct Invoice Payload
        const payload = {
            type: 'invoice',
            description: `Order #${receipt} - Payment Status: PAID`, // Add status to description since Amount Paid might be 0 for separate invoices
            date: Math.floor(Date.now() / 1000), // Unix timestamp
            customer: {
                name: customer.name,
                email: customer.email,
                ...(customer.phone && { contact: customer.phone })
            },
            line_items: cleanLineItems,
            receipt: receipt,
            sms_notify: process.env.RAZORPAY_SMS_NOTIFY === 'true' ? 1 : 0,
            email_notify: process.env.RAZORPAY_EMAIL_NOTIFY === 'true' ? 1 : 0
        };

        logger.info({
            receipt,
            itemCount: payload.line_items.length,
            hasDiscount: discountVal > 0,
            sms_notify: payload.sms_notify,
            email_notify: payload.email_notify
        }, '[Checkout] Creating Razorpay invoice');


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

        let finalInvoice = invoice;
        if (invoice.status === RAZORPAY_STATUS.DRAFT) {
            finalInvoice = await razorpay.invoices.issue(invoice.id);
        }

        log.operationSuccess('CREATE_RAZORPAY_INVOICE', {
            invoiceId: finalInvoice.id,
            orderId: finalInvoice.order_id,
            amount: finalInvoice.amount,
            status: finalInvoice.status
        }, Date.now() - startTime);

        // We return an object that looks like an "Order" to keep backend consistent
        // The frontend only cares about `id` (which should be order_id)
        return {
            id: finalInvoice.order_id, // CRITICAL: Frontend expects Order ID, not Invoice ID
            invoice_id: finalInvoice.id,
            amount: finalInvoice.amount || Math.round(amount * 100),
            currency: finalInvoice.currency,
            status: finalInvoice.status
        };
    } catch (error) {
        log.operationError('CREATE_RAZORPAY_INVOICE', error, { amount, receipt });

        // Extract error message from Razorpay error object for internal logging
        const technicalMessage = error.error?.description || error.description || error.message || 'Unknown Razorpay error';

        logger.error({
            err: error,
            technicalMessage,
            amount,
            receipt,
            customer
        }, '[Checkout] Razorpay invoice creation failed');

        // Throw a friendly error with a code for the middleware to map
        const friendlyError = new Error(MESSAGES.CHECKOUT.GATEWAY_ERROR);
        friendlyError.code = 'RAZORPAY_ERROR';
        friendlyError.statusCode = 502; // Bad Gateway as it's a third-party issue
        throw friendlyError;
    }
};

// Verify Razorpay payment signature
const verifyRazorpayPayment = (orderId, paymentId, signature) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        throw new Error(MESSAGES.CHECKOUT.SYSTEM_ERROR);
    }

    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

    if (expectedSignature !== signature) {
        // Log mismatch details (masked) for debugging
        const maskedSecret = keySecret.substring(0, 4) + '***';
        // Do NOT log the full signatures in production, but for now we need to know why.
        // Actually, never log the secret.
        // We can log the inputs.
        // logger.debug({ orderId, paymentId, signatureLength: signature.length }, 'Signature verification inputs');
    }

    return expectedSignature === signature;
};

// Create payment record
const createPaymentRecord = async (paymentData) => {
    // Note: receipt/orderNumber should be passed in valid columns (e.g. metadata)
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
        razorpay_payment_id, // Destructure here
        notes,
        orderNumber // NEW: Receipt ID passed from payment record
    } = checkoutData;


    // PERFORMANCE: Pass existing cart to avoid refetching in calculateCartTotals
    const totals = await calculateCartTotals(userId, null, cart);

    // Check stock availability BEFORE processing order
    const stockCheck = await checkStockAvailability(cart.cart_items);
    if (!stockCheck.available) {
        const itemNames = stockCheck.insufficientItems.map(i => i.title || i.product_id).join(', ');
        throw new Error(`Insufficient stock for: ${itemNames}`);
    }

    // --- COUPON SAFETY GUARD (Defense-in-Depth) ---
    // PRIMARY validation happens in /create-payment-order BEFORE payment capture
    // This is a SECONDARY check to catch race conditions (e.g., coupon disabled between payment steps)
    if (cart.applied_coupon_code) {
        // Normalize items for validation (Service expects 'product' and 'variant' keys)
        const normalizedItems = cart.cart_items.map(item => ({
            ...item,
            product: item.products,
            variant: item.product_variants
        }));

        // Force live check for critical operation
        const validation = await validateCoupon(cart.applied_coupon_code, userId, normalizedItems, totals.totalPrice, true);

        if (!validation.valid) {
            log.warn('STALE_COUPON_REJECTED_POST_PAYMENT', 'Coupon invalid after payment (race condition caught by safety guard)', {
                coupon: cart.applied_coupon_code,
                error: validation.error
            });
            // This should RARELY happen now - only if coupon changed BETWEEN create-payment-order and verify-payment
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
        throw new Error(MESSAGES.CHECKOUT.SHIPPING_ADDRESS_NOT_FOUND);
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
        throw new Error(MESSAGES.CHECKOUT.BILLING_ADDRESS_NOT_FOUND);
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
            tax_type: taxResult.summary.tax_type,
            total_tax: taxResult.summary.total_tax,
            total_amount: taxResult.summary.total_amount
        });
    } catch (err) {
        log.warn('ORDER_TAX_ERROR', 'Failed to calculate taxes, proceeding without', { error: err.message });
    }

    // Prepare order data for transactional RPC
    const orderData = {
        customer_name: profile.name || 'Valued Customer',
        customer_email: profile.email || 'no-email@provided.com',
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
        // Refund Metadata: Will be re-calculated based on item snapshots
        is_delivery_refundable: true,
        delivery_tax_type: 'GST', // System default for now
        status: ORDER_STATUS.PENDING, // Orders start as pending until admin/manager confirms
        payment_status: PAYMENT_STATUS.PAID,
        notes: notes || null,
        // Tax summary - Include Delivery logic
        total_taxable_amount: (taxResult?.summary.total_taxable_amount || 0) + (totals.deliveryCharge || 0),
        total_cgst: (taxResult?.summary.total_cgst || 0) + ((taxResult?.summary.tax_type !== 'INTER' && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
        total_sgst: (taxResult?.summary.total_sgst || 0) + ((taxResult?.summary.tax_type !== 'INTER' && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
        total_igst: (taxResult?.summary.total_igst || 0) + ((taxResult?.summary.tax_type === 'INTER' && totals.deliveryGST) ? totals.deliveryGST : 0)
    };

    // Determine free delivery status for item calculations
    const isFreeDelivery = totals.totalPrice >= (totals.deliverySettings?.threshold || 0);

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
            const deliveryResult = await DeliveryChargeService.calculateDeliveryCharge(
                item.product_id,
                item.variant_id,
                item.quantity,
                isFreeDelivery
            );

            itemDeliveryCharge = deliveryResult.deliveryCharge;
            itemDeliveryGST = deliveryResult.deliveryGST;
            deliverySnapshot = deliveryResult.snapshot;

            // If it's a global charge, mark it
            if (deliveryResult.snapshot.source === 'global') {
                globalDeliveryApplied = true;
            }

            // CRITICAL: If this is the first item and we have a global base charge (surcharge mode),
            // attribute it here so it's captured in snapshots and its policy is respected.
            if (!globalDeliveryApplied && totals.globalDeliveryCharge > 0 && index === 0) {
                itemDeliveryCharge += totals.globalDeliveryCharge;
                itemDeliveryGST += totals.globalDeliveryGST;
                // Determine final policy: If already NON_REFUNDABLE (surcharge), keep it. 
                // Otherwise, set to PARTIAL to indicate hybrid (Refundable Surcharge + Non-Refundable Global).
                const finalPolicy = (deliverySnapshot.delivery_refund_policy === 'NON_REFUNDABLE')
                    ? 'NON_REFUNDABLE'
                    : 'PARTIAL';

                deliverySnapshot = {
                    ...deliverySnapshot,
                    base_delivery_charge: (deliverySnapshot.base_delivery_charge || 0) + totals.globalDeliveryCharge,
                    delivery_refund_policy: finalPolicy,
                    is_global_surcharge: true,
                    non_refundable_delivery_charge: totals.globalDeliveryCharge,
                    non_refundable_delivery_gst: totals.globalDeliveryGST
                };
                globalDeliveryApplied = true;
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
            taxable_amount: taxBreakdown.taxable_amount || null,
            cgst: taxBreakdown.cgst || 0,
            sgst: taxBreakdown.sgst || 0,
            igst: taxBreakdown.igst || 0,
            hsn_code: taxBreakdown.hsn_code || null,
            gst_rate: taxBreakdown.gst_rate || null,
            total_amount: taxBreakdown.total_amount || null,
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

    // RE-CALCULATE REFUNDABILITY based on actual snapshots
    // Ensure we strictly respect 'NON_REFUNDABLE' if any component has it
    const hasNonRefundableCharge = orderItems.some(item =>
        (item.delivery_charge > 0) &&
        item.delivery_calculation_snapshot?.delivery_refund_policy === 'NON_REFUNDABLE'
    );

    orderData.is_delivery_refundable = !hasNonRefundableCharge;

    logger.info({ userId, itemCount: orderItems.length, hasTax: !!taxResult, isDeliveryRefundable: orderData.is_delivery_refundable }, '[Checkout] Creating order via transactional RPC');

    // ATOMIC TRANSACTION: All operations execute together or none do
    // Creates: order, order_items, payment link, admin notifications, 
    // inventory decrease, cart clear - all in one transaction

    // Prepare RPC parameters - ALWAYS pass all 7 params to disambiguate function overloads
    const rpcParams = {
        p_user_id: userId,
        p_order_data: orderData,
        p_order_items: orderItems,
        p_payment_id: payment_id || null,
        p_cart_id: cart.id,
        p_coupon_code: totals.coupon?.code || null,
        p_order_number: checkoutData.orderNumber || null
    };

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_order_transactional', rpcParams);

    if (rpcError) {
        logger.error({ err: rpcError }, '[Checkout] Transactional order creation failed:');
        throw new Error(MESSAGES.CHECKOUT.ORDER_CREATION_FAILED);
    }

    logger.info({
        orderId: rpcResult.id,
        orderNumber: rpcResult.order_number
    }, '[Checkout] Order created successfully via transaction');

    // Prepare order object for response and email (no bundling)
    const order = {
        id: rpcResult.id,
        order_number: rpcResult.order_number,
        status: rpcResult.status,
        total_amount: rpcResult.total_amount,
        customer_name: profile.name,
        customer_email: profile.email,
        items: orderItems,
        // Add missing details for email template
        shipping_address: shippingAddr,
        billing_address: billingAddr,
        subtotal: totals.totalPrice,
        delivery_charge: totals.deliveryCharge, // Show full delivery charge
        coupon_discount: totals.couponDiscount || 0,
        created_at: new Date(),
        // Tax summary - Use snake_case from TaxEngine
        tax: taxResult ? {
            total_taxable_amount: (taxResult.summary.total_taxable_amount || 0) + (totals.deliveryCharge || 0),
            total_cgst: (taxResult.summary.total_cgst || 0) + ((taxResult.summary.tax_type !== 'INTER' && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
            total_sgst: (taxResult.summary.total_sgst || 0) + ((taxResult.summary.tax_type !== 'INTER' && totals.deliveryGST) ? (totals.deliveryGST / 2) : 0),
            total_igst: (taxResult.summary.total_igst || 0) + ((taxResult.summary.tax_type === 'INTER' && totals.deliveryGST) ? totals.deliveryGST : 0),
            total_tax: (taxResult.summary.total_tax || 0) + (totals.deliveryGST || 0),
            tax_type: taxResult.summary.tax_type
        } : null
    };

    // --- HISTORY LOGGING ---
    // Handled atomically by create_order_transactional RPC
    // We do NOT log here to avoid duplicates or race conditions.

    // Log financial event for audit (non-blocking)
    FinancialEventLogger.logOrderCreated(order, taxResult?.summary, userId)
        .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log order creation', { error: err.message }));

    // Generate Invoice immediately for paid orders (if verified)
    // CRITICAL: Invoice generation is MANDATORY for paid orders (GST compliance)
    if (order.status === ORDER_STATUS.CONFIRMED || checkoutData.payment_status === PAYMENT_STATUS.PAID) {
        // OPTIMIZATION: If we already have an invoice ID from the checkout flow (Invoice A),
        // reuse it instead of creating a new one (Invoice B) which would be unpaid.
        if (checkoutData.invoice_id) {
            logger.info({ orderId: order.id, invoiceId: checkoutData.invoice_id }, '[Checkout] Linking existing Razorpay Invoice (Receipt)');

            // Fetch the existing invoice to get the URL
            let inv = await razorpay.invoices.fetch(checkoutData.invoice_id);

            // FIX: Ensure invoice is issued to get the short_url if it's still in draft
            if (inv && inv.status === 'draft') {
                logger.info({ invoiceId: inv.id }, '[Checkout] Issuing draft invoice to generate URL');
                inv = await razorpay.invoices.issue(inv.id);
            }

            if (inv && inv.short_url) {
                order.invoiceUrl = inv.short_url;
                order.invoice_id = checkoutData.invoice_id;

                // Update Order
                await supabase.from('orders').update({
                    invoice_status: 'receipt_generated'
                }).eq('id', order.id);

                // Insert into invoices table for consistency
                await supabase.from('invoices').insert({
                    order_id: order.id,
                    type: 'RAZORPAY',
                    invoice_number: inv.invoice_number,
                    provider_id: inv.id,
                    public_url: inv.short_url,
                    status: inv.status
                });
            } else {
                // CRITICAL: Invoice fetch/issue failed - this is a blocking error
                throw new Error(MESSAGES.CHECKOUT.RAZORPAY_ERROR);
            }
        } else {
            // Fallback: Create new invoice if one doesn't exist
            logger.info({ orderId: order.id }, '[Checkout] Generating immediate Razorpay Payment Receipt');
            const result = await InvoiceOrchestrator.generateRazorpayInvoice(order);

            if (!result.success) {
                // CHANGED: Degrade gracefully instead of blocking the order.
                // Invoice generation is important but shouldn't fail the entire order if the payment is captured.
                logger.error({ err: result.error }, 'Invoice generation failed (non-fatal), proceeding with order');
                order.invoice_status = 'pending_generation';
                // We do NOT throw here anymore. Support can regenerate it.
            }

            if (result.invoiceUrl) {
                order.invoiceUrl = result.invoiceUrl;
                order.invoice_id = result.invoiceId;
                order.invoice_status = 'generated';
            }
        }
    }

    // Log initial payment verification (PAYMENT_SUCCESS)
    // NOTE: 'ORDER_PLACED' is handled by the creation RPC or system trigger, so we avoid duplicating it here.
    try {

        if (checkoutData.payment_status === PAYMENT_STATUS.PAID) {
            await logStatusHistory(order.id, 'PAYMENT_SUCCESS', userId, `Payment verified (ID: ${razorpay_payment_id || payment_id || 'N/A'})`, 'SYSTEM');
            // User requested that orders NOT be auto-confirmed by system. Leaving status as 'pending'.
        }
    } catch (histError) {
        log.warn({ err: histError, orderId: order.id }, '[Checkout] Failed to log payment status history');
    }

    // Send "Order Placed" Email (v2)
    logger.info({ data: profile.email }, '[CheckoutService] Sending order placed email to:');
    emailService.sendOrderPlacedEmail(
        profile.email,
        {
            order: order,
            customerName: profile.name,
            receiptUrl: order.invoiceUrl // Injected from Razorpay Receipt flow
        },
        userId
    ).catch(err => logger.error('Failed to send order placed email:', err));

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

    // CRITICAL: Idempotency check - prevent duplicate event processing
    const eventId = payload.id || `${event}_${payment?.id || order?.id}_${Date.now()}`;

    try {
        // Check if event already processed
        const { data: existingEvent } = await supabase
            .from('webhook_events')
            .select('id')
            .eq('event_id', eventId)
            .maybeSingle();

        if (existingEvent) {
            logger.info({
                eventId,
                event
            }, 'Webhook event already processed - skipping duplicate');
            return { success: true, duplicate: true };
        }

        // Record event as being processed
        await supabase
            .from('webhook_events')
            .insert({
                event_id: eventId,
                event_type: event,
                payload: payload
            });

        logger.info({ eventId, event }, 'Webhook event recorded for processing');

    } catch (idempotencyError) {
        logger.error({
            err: idempotencyError,
            eventId
        }, 'Idempotency check failed - proceeding with caution');
        // Continue processing but log the error
    }

    try {
        if (event === 'payment.captured' && payment) {
            // Payment SUCCESS
            // Find payment record by razorpay_order_id
            const { data: dbPayment, error } = await supabase
                .from('payments')
                .select('*')
                .eq('razorpay_order_id', payment.order_id)
                .maybeSingle();

            if (dbPayment) {
                // Update payment status
                await updatePaymentRecord(dbPayment.id, {
                    status: PAYMENT_STATUS.CAPTURED,
                    razorpay_payment_id: payment.id,
                    method: payment.method,
                    updated_at: new Date().toISOString()
                });

                // Also ensure Order is marked as paid
                if (dbPayment.order_id) {
                    await supabase
                        .from('orders')
                        .update({ payment_status: PAYMENT_STATUS.PAID, status: ORDER_STATUS.CONFIRMED })
                        .eq('id', dbPayment.order_id);

                    // Log history for confirmation
                    try {
                        await logStatusHistory(
                            dbPayment.order_id,
                            'confirmed', // Will map to ORDER_CONFIRMED
                            null, // System action, no user ID
                            'Payment captured via Razorpay Webhook',
                            'SYSTEM'
                        );
                    } catch (histError) {
                        logger.warn({ err: histError, orderId: dbPayment.order_id }, 'Failed to log history in webhook');
                    }
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
                .maybeSingle();

            if (dbPayment) {
                await updatePaymentRecord(dbPayment.id, {
                    status: PAYMENT_STATUS.FAILED,
                    error_description: payment.error_description || 'Payment Failed via Webhook',
                    updated_at: new Date().toISOString()
                });

                // If order exists, mark as pending payment or cancelled?
                // Usually keep as 'created' or 'pending_payment'

                if (dbPayment.order_id) {
                    try {
                        await logStatusHistory(
                            dbPayment.order_id,
                            'PAYMENT_FAILED',
                            null,
                            payment.error_description || 'Payment Failed via Webhook',
                            'SYSTEM'
                        );
                    } catch (histError) {
                        logger.warn({ err: histError }, 'Failed to log payment failure in webhook');
                    }
                }
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
                    status: PAYMENT_STATUS.REFUNDED, // or partial_refunded
                    refund_id: refund.id,
                    refund_status: refund.status,
                    updated_at: new Date().toISOString()
                });

                if (dbPayment.order_id) {
                    await supabase
                        .from('orders')
                        .update({ payment_status: PAYMENT_STATUS.REFUNDED, status: ORDER_STATUS.REFUNDED })
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
        const { data: payment, error: fetchError } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            throw new Error(MESSAGES.CHECKOUT.PAYMENT_RECORD_NOT_FOUND);
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
            throw new Error(MESSAGES.CHECKOUT.REFUND_FAILED_NO_ID);
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
            status: PAYMENT_STATUS.REFUNDED
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
                if (payment.status !== RAZORPAY_STATUS.CAPTURED && payment.status !== RAZORPAY_STATUS.AUTHORIZED) {
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

                    // CRITICAL: Additional validation before auto-refund
                    const shouldRefund = (
                        (payment.status === 'captured' || payment.status === 'authorized') &&
                        (payment.order_id !== razorpay_order_id || s2sError.message.includes('mismatch'))
                    );

                    if (shouldRefund) {
                        // Validate amount matches expected (prevent refunding wrong amount)
                        const paymentAmount = payment.amount / 100; // Convert from paise
                        const expectedAmount = captureAmount;

                        if (Math.abs(paymentAmount - expectedAmount) > 1) {
                            logger.error({
                                paymentAmount,
                                expectedAmount,
                                difference: Math.abs(paymentAmount - expectedAmount)
                            }, 'CRITICAL: Payment amount mismatch - manual review required');

                            throw new Error(MESSAGES.CHECKOUT.PAYMENT_MISMATCH);
                        }

                        logger.warn({
                            razorpay_payment_id,
                            razorpay_order_id,
                            payment_order_id: payment.order_id,
                            reason: s2sError.message
                        }, 'Auto-Refunding failed/mismatched payment after validation');

                        await razorpay.payments.refund(razorpay_payment_id, {
                            reason: `Validation/Verification Failed: ${s2sError.message}`
                        });

                        if (payment_id) {
                            await updatePaymentRecord(payment_id, {
                                status: 'refunded',
                                error_description: s2sError.message
                            });
                        }

                        const refundError = new Error(MESSAGES.CHECKOUT.PAYMENT_REFUNDED_FAILURE);
                        refundError.status = 400;
                        throw refundError;
                    } else {
                        logger.warn({
                            payment_status: payment.status,
                            payment_order_id: payment.order_id,
                            expected_order_id: razorpay_order_id
                        }, 'Payment not eligible for auto-refund - manual review may be required');
                    }
                } catch (refundErr) {
                    // Start of refund error handling (if refund fails, or if it was thrown above)
                    if (refundErr.message.includes('has been refunded') ||
                        refundErr.message.includes('amount mismatch')) {
                        throw refundErr;
                    }

                    logger.error({
                        err: refundErr,
                        razorpay_payment_id
                    }, 'Auto-refund attempt failed');
                }

                // Update payment as failed
                if (payment_id) {
                    await updatePaymentRecord(payment_id, {
                        status: PAYMENT_STATUS.FAILED,
                        error_description: s2sError.message || 'Invalid payment signature'
                    });
                }
                const error = new Error(MESSAGES.CHECKOUT.SIGNATURE_INVALID);
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
                status: PAYMENT_STATUS.CAPTURED // It is already captured!
            });
        }

        logger.info({
            razorpay_payment_id,
            razorpay_order_id,
            amount: captureAmount
        }, '[Checkout] Payment signature verified (Auto-captured), proceeding with order creation');

        // NO EMAIL: Payment confirmed email is deprecated per email policy
        // Order confirmation email will be sent after order creation
        logger.info({ userId, razorpay_payment_id }, '[Checkout] Payment confirmed - email notification disabled per policy');

    } else {
        logger.info('Processing mock payment for testing...');
        // For mock payments, ensure record is updated if exists
        if (payment_id) {
            try {
                await updatePaymentRecord(payment_id, {
                    razorpay_payment_id,
                    razorpay_signature,
                    status: PAYMENT_STATUS.CAPTURED // Mock payments are auto-captured
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
                .select('id, status, metadata') // Fetch metadata too
                .eq('razorpay_order_id', razorpay_order_id)
                .single();

            if (existingPayment) {
                // CRITICAL: Validate payment status before recovery
                if (existingPayment.status === PAYMENT_STATUS.CAPTURED || existingPayment.status === PAYMENT_STATUS.PAID) {
                    payment_id = existingPayment.id;
                    // Check for persisted receipt ID
                    if (existingPayment.metadata?.receipt) {
                        // Pass this to createOrder
                        notes = { ...notes, _receipt: existingPayment.metadata.receipt };
                    }
                    logger.info({
                        recovered_payment_id: payment_id,
                        status: existingPayment.status
                    }, 'Recovered missing payment_id via razorpay_order_id');
                } else {
                    logger.error({
                        payment_id: existingPayment.id,
                        status: existingPayment.status,
                        razorpay_order_id
                    }, 'Payment recovery failed: invalid payment status');
                    throw new Error(`Payment recovery failed: payment status is ${existingPayment.status}, not captured`);
                }
            }
        } catch (e) {
            // If it's our validation error, re-throw it
            if (e.message.includes('Payment recovery failed')) {
                throw e;
            }
            // Log warning but proceed - this is a recovery attempt, not critical path
            logger.warn({ err: e, razorpay_order_id }, 'Failed to recover payment_id via razorpay_order_id');
        }
    } else if (payment_id) {
        // If payment_id IS provided, fetch metadata to get the Receipt ID
        try {
            const { data: existingPayment } = await supabase
                .from('payments')
                .select('metadata')
                .eq('id', payment_id)
                .single();

            if (existingPayment?.metadata?.receipt) {
                notes = { ...notes, _receipt: existingPayment.metadata.receipt };
            }
        } catch (e) {
            logger.warn({ err: e, payment_id }, 'Failed to fetch payment metadata for receipt ID');
        }
    }

    // --- DB TRANSACTION PHASE ---
    try {
        // Extract pre-generated order number from payment receipt
        let preGeneratedOrderNumber = null;
        if (payment_id) {
            try {
                const { data: existingPayment } = await supabase
                    .from('payments')
                    .select('metadata')
                    .eq('id', payment_id)
                    .single();

                preGeneratedOrderNumber = existingPayment?.metadata?.receipt || null;
            } catch (e) {
                logger.warn({ err: e, payment_id }, 'Failed to fetch payment receipt for order number');
            }
        }

        // Create order via atomic PostgreSQL transaction
        const order = await createOrder(
            userId,
            {
                shipping_address_id,
                billing_address_id,
                payment_id,
                notes,
                payment_status: PAYMENT_STATUS.PAID,
                razorpay_payment_id,
                orderNumber: preGeneratedOrderNumber, // Use the pre-generated number from Razorpay receipt
                invoice_id: (payment_id && !isMockPayment) ?
                    (await supabase.from('payments').select('invoice_id').eq('id', payment_id).single()).data?.invoice_id
                    : null
            },
            cart
        );

        // Log functionality for Timeline (Fix for missing history)
        // User requested that orders NOT be auto-confirmed by system. Leaving status as 'pending'.

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
                order_number: order.order_number,
                total_amount: order.total_amount,
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
                }, '[Checkout] Payment refunded successfully after order creation failure');

                const userError = new Error(`Order creation failed [${systemError.message}] but your payment has been refunded automatically. The amount will be credited to your account within 5-7 business days.`);
                userError.status = 500;
                throw userError;

            } catch (refundError) {
                // Check if this is our intentional re-throw (refund succeeded but we're throwing user-friendly message)
                if (refundError.message.includes('Order creation failed') && refundError.message.includes('refunded')) {
                    throw refundError;
                }

                logger.error({
                    err: refundError,
                    razorpay_payment_id,
                    razorpay_order_id,
                    payment_id
                }, '[Checkout] CRITICAL: Failed to refund payment after DB failure!');

                // Update payment record to indicate refund failure
                if (payment_id) {
                    try {
                        await updatePaymentRecord(payment_id, {
                            status: 'refund_failed',
                            error_description: `Order creation failed: ${systemError.message}. Refund failed: ${refundError.message}`
                        });
                    } catch (updateErr) {
                        logger.error({ err: updateErr, payment_id }, 'Failed to update payment status after refund failure');
                    }
                }

                const userError = new Error(`Order creation failed [${systemError.message}] and automatic refund encountered an issue. Please contact support immediately with Payment ID: ${razorpay_payment_id}. Our team will process your refund manually.`);
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
/**
 * Process Buy Now flow
 * Refactored to reuse standard createOrder logic via a virtual cart
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
    let isValidSignature = verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValidSignature) {
        log.warn('BUY_NOW_INVALID_SIGNATURE', 'Invalid payment signature. Attempting S2S verification.', {
            razorpay_payment_id,
            razorpay_order_id
        });

        try {
            // Server-to-Server Verification (Source of Truth)
            const payment = await razorpay.payments.fetch(razorpay_payment_id);

            log.info({
                fetched_order_id: payment.order_id,
                expected_order_id: razorpay_order_id,
                status: payment.status
            }, 'S2S Buy Now Payment Fetched');

            // Check 1: Is payment successful?
            if (payment.status !== 'captured' && payment.status !== 'authorized') {
                throw new Error(`Payment status is ${payment.status} (not captured)`);
            }

            // Check 2: Does Order ID match?
            if (razorpay_order_id && payment.order_id !== razorpay_order_id) {
                throw new Error(`Order ID mismatch: Payment is for ${payment.order_id}, expected ${razorpay_order_id}`);
            }

            // If we are here, S2S is valid!
            isValidSignature = true;
            log.info('BUY_NOW_S2S_SUCCESS', 'S2S verification passed for Buy Now. Proceeding with order creation.');

        } catch (s2sError) {
            log.error({ err: s2sError }, 'Buy Now S2S Verification Failed.');
            const error = new Error(MESSAGES.CHECKOUT.VERIFICATION_FAILED);
            error.status = 400;
            throw error;
        }
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
        // 2. Construct Virtual Cart (Merged with existing cart item if present)
        const virtualCart = await createBuyNowVirtualCart(userId, null, { productId, variantId, quantity });
        virtualCart.id = null; // Explicitly set to null for createOrder to treat it as virtual (no DB updates)

        // 3. Reuse standard createOrder logic
        // We need to fetch the invoice_id and receipt (order number) from the payment record if it exists
        let invoice_id = null;
        let orderNumber = null;
        let notesWithRef = notes || 'Buy Now Order'; // Use new variable instead of reassigning const

        if (payment_id) {
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('invoice_id, metadata')
                .eq('id', payment_id)
                .single();
            invoice_id = paymentRecord?.invoice_id;
            orderNumber = paymentRecord?.metadata?.receipt || null;

            if (orderNumber && notes && typeof notes === 'string') {
                notesWithRef = `${notes} (Ref: ${orderNumber})`;
            }
        }

        const order = await createOrder(
            userId,
            {
                shipping_address_id,
                billing_address_id,
                payment_id,
                notes: notesWithRef,
                payment_status: 'paid',
                razorpay_payment_id,
                invoice_id,
                orderNumber: orderNumber // Use the pre-generated number from Razorpay receipt
            },
            virtualCart
        );


        // 4. CLEANUP: Remove the purchased item from cart if it exists
        if (userId) {
            try {
                await removeFromCart(userId, null, productId, variantId);
                log.info('BUY_NOW_CART_CLEANUP', 'Removed purchased Buy Now item from cart', { productId, variantId });
            } catch (cleanupError) {
                log.warn({ err: cleanupError }, 'Failed to remove Buy Now item from cart (Non-critical)');
            }
        }

        log.info('BUY_NOW_SUCCESS', 'Buy Now order created successfully', { orderId: order.id });

        return {
            success: true,
            order: {
                id: order.id,
                order_number: order.order_number,
                total_amount: order.total_amount,
                status: order.status
            }
        };

    } catch (error) {
        log.operationError('BUY_NOW_ERROR', error, { productId, variantId });

        // TECHNICAL REFUND: If order creation fails after payment
        if (razorpay_payment_id) {
            let refundSuccess = false;
            let refundError = null;

            try {
                if (payment_id) {
                    await RefundService.asyncProcessRefund(payment_id, REFUND_TYPES.TECHNICAL_REFUND, 'SYSTEM', `Buy Now order failed: ${error.message}`, true);
                } else {
                    await refundPayment(razorpay_payment_id, null, {
                        reason: `Buy Now order failed: ${error.message}`
                    });
                }
                refundSuccess = true;
                logger.info({ razorpay_payment_id, payment_id }, '[BuyNow] Technical refund initiated successfully after order failure');
            } catch (refundErr) {
                refundError = refundErr;
                logger.error({
                    err: refundErr,
                    razorpay_payment_id,
                    payment_id,
                    originalError: error.message
                }, 'CRITICAL: Technical refund failed after order creation failure!');

                // Update payment record to indicate refund failure
                if (payment_id) {
                    try {
                        await updatePaymentRecord(payment_id, {
                            status: 'refund_failed',
                            error_description: `Order failed: ${error.message}. Refund failed: ${refundErr.message}`
                        });
                    } catch (updateErr) {
                        logger.error({ err: updateErr, payment_id }, 'Failed to update payment status after refund failure');
                    }
                }
            }

            // Throw user-friendly error based on refund status
            if (refundSuccess) {
                const userError = new Error(MESSAGES.CHECKOUT.ORDER_CREATION_FAILED_REFUNDED);
                userError.status = 500;
                throw userError;
            } else {
                const userError = new Error(`Order creation failed and automatic refund encountered an issue. Please contact support immediately with Payment ID: ${razorpay_payment_id}. Our team will process your refund manually.`);
                userError.status = 500;
                throw userError;
            }
        }

        throw error;
    }
}

/**
 * Get summary for Buy Now flow
 * Reuses standard calculation logic by constructing a virtual cart
 */
const getBuyNowSummary = async (userId, buyNowData, addressId = null) => {
    try {
        const { productId, variantId, quantity = 1 } = buyNowData;

        // 1. Create virtual cart
        const virtualCart = await createBuyNowVirtualCart(userId, null, buyNowData);

        // 2. Calculate totals using standard service
        const totals = await calculateCartTotals(userId, null, virtualCart);

        // 3. PHASE 3A OPTIMIZATION: Fetch user profile once
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        // 4. Fetch addresses
        const addresses = await getUserAddresses(userId);
        const primaryAddress = addresses.find(a => a.is_primary) || addresses[0];

        let shipping_address = null;
        if (addressId) {
            shipping_address = addresses.find(a => a.id === addressId);
        }
        if (!shipping_address) {
            shipping_address = primaryAddress;
        }

        return {
            cart: virtualCart,
            totals,
            shipping_address,
            billing_address: shipping_address, // Default billing to shipping
            user_profile: profile, // PHASE 3A: Include profile
            isBuyNow: true
        };
    } catch (error) {
        log.error({ err: error }, 'Error in getBuyNowSummary');
        throw error;
    }
}

module.exports = {
    getCheckoutSummary,
    getBuyNowSummary,
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

