const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { calculateCartTotals, getUserCart } = require('./cart.service');
const { getPrimaryAddress, getLatestAddress } = require('./address.service');
const { checkStockAvailability, decreaseInventory } = require('./inventory.service');
const emailService = require('./email');
const { capturePayment, voidAuthorization } = require('../utils/razorpay-helper');

// Create module-specific logger
const log = createModuleLogger('CheckoutService');

/**
 * Checkout Service
 * Handles checkout flow, Razorpay integration, and order creation
 */

// Initialize Razorpay
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

// logger.info('Razorpay Init - Key ID:', key_id ? `...${key_id.slice(-4)}` : 'MISSING');
// logger.info({ data: !!key_secret }, 'Razorpay Init - Secret exists:');

const razorpay = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});

// Get checkout summary (cart + addresses + totals)
const getCheckoutSummary = async (userId) => {
    // Get cart with totals
    const cart = await getUserCart(userId);
    // PERFORMANCE: Pass existing cart to avoid refetching in calculateCartTotals
    const totals = await calculateCartTotals(userId, cart);

    // Get primary shipping address -> latest shipping -> latest any
    let shippingAddress = await getPrimaryAddress(userId, 'shipping');
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

    return {
        cart,
        totals,
        shipping_address: shippingAddress,
        billing_address: billingAddress
    };
};

// Create Razorpay order with AUTO CAPTURE
// Payment is captured immediately
const createRazorpayOrder = async (amount, receipt) => {
    log.operationStart('CREATE_RAZORPAY_ORDER', { amount, receipt });
    const startTime = Date.now();

    try {
        const options = {
            amount: Math.round(amount * 100), // amount in paise
            currency: 'INR',
            receipt: receipt,
            payment_capture: 1 // AUTO CAPTURE - capture immediately
        };

        const order = await razorpay.orders.create(options);
        log.operationSuccess('CREATE_RAZORPAY_ORDER', {
            orderId: order.id,
            captureMode: 'auto',
            amountPaise: order.amount
        }, Date.now() - startTime);
        return order;
    } catch (error) {
        log.operationError('CREATE_RAZORPAY_ORDER', error, { amount, receipt });
        throw new Error('Failed to create payment order');
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
const createOrder = async (userId, checkoutData) => {
    const {
        shipping_address_id,
        billing_address_id,
        payment_id,
        notes
    } = checkoutData;

    // Get cart and totals
    const cart = await getUserCart(userId);
    // PERFORMANCE: Pass existing cart to avoid refetching in calculateCartTotals
    const totals = await calculateCartTotals(userId, cart);

    // Check stock availability BEFORE processing order
    const stockCheck = await checkStockAvailability(cart.cart_items);
    if (!stockCheck.available) {
        const itemNames = stockCheck.insufficientItems.map(i => i.title || i.product_id).join(', ');
        throw new Error(`Insufficient stock for: ${itemNames}`);
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

    // Prepare order data for transactional RPC
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
        status: 'pending', // Orders start as pending until admin/manager confirms
        paymentStatus: 'paid',
        notes: notes || null
    };

    // Prepare order items for transactional RPC
    const orderItems = cart.cart_items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        product: {
            id: item.products?.id || item.product_id,
            title: item.products?.title || 'Product',
            price: item.products?.price || 0,
            images: item.products?.images || [],
            isReturnable: item.products?.isReturnable ?? item.products?.is_returnable ?? true
        }
    }));

    logger.info({ userId, itemCount: orderItems.length }, '[Checkout] Creating order via transactional RPC');

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

    // Construct order object for response and email
    // Construct order object for response and email
    const order = {
        id: rpcResult.id,
        order_number: rpcResult.order_number || rpcResult.orderNumber,
        orderNumber: rpcResult.order_number || rpcResult.orderNumber,
        status: rpcResult.status,
        totalAmount: rpcResult.totalAmount,
        customerName: profile.name,
        customerEmail: profile.email,
        items: orderItems,
        // Add missing details for email template
        shippingAddress: shippingAddr,
        billingAddress: billingAddr,
        subtotal: totals.totalPrice,
        delivery_charge: totals.deliveryCharge || 0,
        coupon_discount: totals.couponDiscount || 0,
        createdAt: new Date()
    };

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
            // Update payment as failed
            if (payment_id) {
                await updatePaymentRecord(payment_id, {
                    status: 'failed',
                    error_description: 'Invalid payment signature'
                });
            }
            const error = new Error('Invalid payment signature');
            error.status = 400;
            throw error;
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

    // --- DB TRANSACTION PHASE ---
    try {
        // Create order via atomic PostgreSQL transaction
        const order = await createOrder(userId, {
            shipping_address_id,
            billing_address_id,
            payment_id,
            notes
        });

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
                // Determine amount to refund (full amount)
                const refundAmount = captureAmount;
                const { refundPayment } = require('../utils/razorpay-helper');

                await refundPayment(razorpay_payment_id, null, {
                    reason: `Order creation failed: ${systemError.message}`
                });

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

                const userError = new Error('Order creation failed and payment has been refunded. Please try again.');
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

module.exports = {
    getCheckoutSummary,
    createRazorpayOrder,
    verifyRazorpayPayment,
    createPaymentRecord,
    updatePaymentRecord,
    createOrder,
    processPaymentAndOrder,
    handleWebhookEvent,
    processRefund
};
