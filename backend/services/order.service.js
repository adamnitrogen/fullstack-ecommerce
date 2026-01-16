
const logger = require('../utils/logger');
const supabase = require('../config/supabase');
const emailService = require('./email');
const razorpayInvoiceService = require('./razorpay-invoice.service');
const { formatAddress } = require('./address.service');
// PERFORMANCE: Moved to top-level to avoid require() overhead on each function call
const inventoryService = require('./inventory.service');
const checkoutService = require('./checkout.service');
// GST Invoice and Audit
const { InvoiceOrchestrator } = require('./invoice-orchestrator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');

const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    PACKED: 'packed',
    SHIPPED: 'shipped',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURN_REQUESTED: 'return_requested',
    RETURN_APPROVED: 'return_approved', // Added for clarity
    RETURNED: 'returned',
    REFUNDED: 'refunded',
    RETURN_REJECTED: 'return_rejected'
};

const ALLOWED_TRANSITIONS = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.PACKED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PACKED]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.OUT_FOR_DELIVERY], // Cannot cancel once shipped usually
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURNED], // Returned if delivery failed
    [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.RETURN_REQUESTED],
    [ORDER_STATUS.RETURN_REQUESTED]: [ORDER_STATUS.RETURN_APPROVED, ORDER_STATUS.RETURN_REJECTED], // Approve or Reject
    [ORDER_STATUS.RETURN_APPROVED]: [ORDER_STATUS.RETURNED],
    [ORDER_STATUS.RETURNED]: [ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.CANCELLED]: [ORDER_STATUS.REFUNDED], // If paid, can refund
    [ORDER_STATUS.REFUNDED]: [], // Terminal state
    [ORDER_STATUS.RETURN_REJECTED]: [] // Terminal state
};

// User-friendly messages for each status transition (shown in order timeline)
const STATUS_MESSAGES = {
    [ORDER_STATUS.PENDING]: 'Order placed successfully. Awaiting confirmation.',
    [ORDER_STATUS.CONFIRMED]: 'Order has been confirmed.',
    [ORDER_STATUS.PROCESSING]: 'Order is being processed and prepared for packing.',
    [ORDER_STATUS.PACKED]: 'Order has been packed and is ready for dispatch.',
    [ORDER_STATUS.SHIPPED]: 'Order has been shipped and is on its way.',
    [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Order is out for delivery. You will receive it soon!',
    [ORDER_STATUS.DELIVERED]: 'Order has been delivered successfully.',
    [ORDER_STATUS.CANCELLED]: 'Order has been cancelled.',
    [ORDER_STATUS.RETURN_REQUESTED]: 'Return request submitted. Awaiting approval.',
    [ORDER_STATUS.RETURN_APPROVED]: 'Return request approved. Please ship the items back.',
    [ORDER_STATUS.RETURN_REJECTED]: 'Return request has been rejected.',
    [ORDER_STATUS.RETURNED]: 'Returned items received at warehouse.',
    [ORDER_STATUS.REFUNDED]: 'Refund has been processed successfully.'
};

/**
 * Validates if the transition from current to new status is allowed.
 * @param {string} currentStatus 
 * @param {string} newStatus 
 * @returns {boolean}
 */
function isValidTransition(currentStatus, newStatus) {
    // Admin override or special cases can be handled here if needed
    // For now strict graph
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(newStatus);
}

/**
 * Logs a status change to the order_status_history table.
 * @param {string} orderId 
 * @param {string} status 
 * @param {string} updatedBy - User ID
 * @param {string} notes 
 */
async function logStatusHistory(orderId, status, updatedBy, notes = '') {
    let { error } = await supabase
        .from('order_status_history')
        .insert({
            order_id: orderId,
            status,
            updated_by: updatedBy,
            notes,
            created_at: new Date().toISOString()
        });

    if (error) {
        logger.warn(`Failed to log history for order ${orderId} with user ${updatedBy}. Error: ${error.message}. Code: ${error.code}`);

        // Retry without user if FK violation (23503) or generic error, to ensure history is captured
        if (error.code === '23503' || error) {
            logger.info(`Retrying log history for order ${orderId} as System (null user)`);
            const { error: retryError } = await supabase
                .from('order_status_history')
                .insert({
                    order_id: orderId,
                    status,
                    updated_by: null, // System update
                    notes,
                    created_at: new Date().toISOString()
                });

            if (retryError) {
                logger.error(`Failed to log history fallback for order ${orderId}:`, retryError);
            }
        }
    }
}

/**
 * Centrally manages order status updates including validation, inventory, and logging.
 * @param {string} orderId 
 * @param {string} newStatus 
 * @param {string} userId 
 * @param {string} notes 
 * @returns {Promise<{success: boolean, order?: object, error?: string, status?: number}>}
 */
async function updateOrderStatus(orderId, newStatus, userId, notes = '', role = 'customer') {
    const { restoreInventory } = inventoryService;

    try {
        // 1. Get current order
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return { success: false, status: 404, error: 'Order not found' };
        }

        const previousStatus = order.status;

        // 2. Validate Transition (Skip for Admin/Manager)
        const isAdminOrManager = ['admin', 'manager'].includes(role);
        if (!isAdminOrManager && !isValidTransition(previousStatus, newStatus)) {
            return {
                success: false,
                status: 400,
                error: `Invalid status transition from ${previousStatus} to ${newStatus}`
            };
        }

        // 3. Inventory Management Logic
        const inventoryRestoreStatuses = [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURN_APPROVED];
        // Note: Logic in route said "RETURNED" but usually it's upon approval or completion? 
        // Existing route logic checked CANCELLED and RETURNED. 
        // Let's align with existing code:
        const activeStatuses = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED];

        const wasActive = activeStatuses.includes(previousStatus);
        const becomingInactive = inventoryRestoreStatuses.includes(newStatus) || newStatus === ORDER_STATUS.RETURNED;

        if (wasActive && becomingInactive && order.items) {
            logger.info(`[Order ${orderId}] Restoring inventory for ${newStatus}`);
            await restoreInventory(order.items);
        }

        // 4. Update Order
        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update({
                status: newStatus,
                updatedAt: new Date().toISOString()
            })
            .eq('id', orderId)
            .select()
            .single();

        if (updateError) throw updateError;

        // 5. Log History with descriptive message
        const statusMessage = notes || STATUS_MESSAGES[newStatus] || `Status updated to ${newStatus}`;
        await logStatusHistory(orderId, newStatus, userId, statusMessage);

        // 6. Handle Refund Logic
        const PRE_SHIP_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED];
        const isPaid = order.paymentStatus === 'paid' || order.payment_status === 'paid';
        let refundInitiated = false;

        // Resolve payment_id: Use order.payment_id, or fallback to lookup via payments.order_id
        let resolvedPaymentId = order.payment_id;
        if (!resolvedPaymentId && isPaid) {
            logger.info(`[Order ${orderId}] payment_id is null, attempting fallback lookup via payments.order_id`);
            const { data: paymentRecord } = await supabase
                .from('payments')
                .select('id')
                .eq('order_id', orderId)
                .single();
            if (paymentRecord) {
                resolvedPaymentId = paymentRecord.id;
                logger.info(`[Order ${orderId}] Found payment via fallback: ${resolvedPaymentId}`);
            }
        }

        if (isPaid && resolvedPaymentId) {
            // Case 1: Cancelled before shipping - immediate refund (ASYNC for speed)
            if (newStatus === ORDER_STATUS.CANCELLED && PRE_SHIP_STATUSES.includes(previousStatus)) {
                // Mark as refund_initiated immediately for UX
                await supabase.from('orders').update({ paymentStatus: 'refund_initiated' }).eq('id', orderId);
                await logStatusHistory(orderId, ORDER_STATUS.CANCELLED, userId, 'Refund Initiated: Amount will be credited within 5-7 business days');
                refundInitiated = true;

                // Process actual Razorpay refund in background (non-blocking)
                const { processRefund } = checkoutService;
                processRefund(resolvedPaymentId)
                    .then(refundResult => {
                        if (refundResult?.skipped) {
                            logger.info(`[Order ${orderId}] Refund skipped: ${refundResult.reason}`);
                        } else {
                            logger.info(`[Order ${orderId}] Razorpay refund processed successfully`);
                        }
                    })
                    .catch(refundErr => {
                        logger.error(`[Order ${orderId}] Background refund failed:`, refundErr.message);
                        // TODO: Could add to a retry queue or alert admin
                    });
            }

            // Case 2: Product returned to warehouse - refund now
            if (newStatus === ORDER_STATUS.RETURNED) {
                try {
                    logger.info(`[Order ${orderId}] Status updated to RETURNED. Verifying refund eligibility...`);

                    // Fetch approved return request to calculate custom refund amount
                    const { data: returnReq, error: retErr } = await supabase
                        .from('returns')
                        .select(`
                            id, 
                            order_id,
                            return_items (
                                quantity,
                                order_item_id,
                                order_items (
                                    price_per_unit
                                )
                            )
                        `)
                        .eq('order_id', orderId)
                        .eq('status', 'approved')
                        .single();

                    if (retErr || !returnReq) {
                        logger.error(`[Order ${orderId}] No approved return request found for this order. Skipping refund.`);
                    } else {
                        // Calculate verified refund amount
                        let verifiedRefundAmount = 0;
                        for (const item of returnReq.return_items) {
                            const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                            if (orderItem && orderItem.price_per_unit) {
                                verifiedRefundAmount += (orderItem.price_per_unit * item.quantity);
                            }
                        }

                        // Execute Refund via Razorpay
                        logger.info(`[Order ${orderId}] Processing Verified Refund: Amount=${verifiedRefundAmount}`);

                        if (!verifiedRefundAmount || verifiedRefundAmount <= 0) {
                            logger.error(`[Order ${orderId}] Verified Refund Verification Failed: Calculated amount is ${verifiedRefundAmount}. Skipping refund to avoid full charge reversal.`);
                            // Do not complete the refund if amount is invalid
                        } else {
                            const { processRefund } = checkoutService;

                            // Pass specific amount to refund service
                            const refundResult = await processRefund(resolvedPaymentId, verifiedRefundAmount);

                            if (refundResult?.skipped) {
                                logger.info(`[Order ${orderId}] Refund skipped: ${refundResult.reason}`);
                            } else {
                                await supabase.from('orders').update({ paymentStatus: 'refund_initiated' }).eq('id', orderId);

                                await supabase.from('refunds').insert({
                                    return_id: returnReq.id,
                                    order_id: orderId,
                                    razorpay_refund_id: refundResult.id,
                                    amount: verifiedRefundAmount,
                                    status: 'processed'
                                });

                                logger.info(`[Order ${orderId}] Verified Refund successfully processed.`);
                                refundInitiated = true;
                            }
                        }
                    }
                } catch (refundErr) {
                    logger.error(`[Order ${orderId}] Verified Refund failed:`, refundErr.message);
                }
            }
        }

        // Re-fetch order if refund was initiated to get updated paymentStatus
        let finalOrder = updatedOrder;
        if (refundInitiated) {
            const { data: refreshedOrder } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();
            if (refreshedOrder) {
                finalOrder = refreshedOrder;
            }
        }

        // 7. Generate GST Invoice on DELIVERED (non-blocking)
        if (newStatus === ORDER_STATUS.DELIVERED) {
            InvoiceOrchestrator.generateInvoiceForOrder(orderId)
                .then(result => {
                    if (result.success) {
                        logger.info(`[Order ${orderId}] GST Invoice generated: ${result.invoiceId}`);
                    } else {
                        logger.error(`[Order ${orderId}] GST Invoice generation failed: ${result.error}`);
                    }
                })
                .catch(err => logger.error(`[Order ${orderId}] Invoice generation error:`, err.message));
        }

        // 8. Send Refund Email notifications
        if (newStatus === ORDER_STATUS.RETURNED && refundInitiated) {
            // Get user info and send REFUND_INITIATED email
            const { data: orderWithUser } = await supabase
                .from('orders')
                .select('user_id, profiles:user_id(email, name), total_taxable_amount, total_cgst, total_sgst, total_igst')
                .eq('id', orderId)
                .single();

            if (orderWithUser?.profiles?.email) {
                // Get return info for refund breakdown
                const { data: returnReq } = await supabase
                    .from('returns')
                    .select('refund_amount, refund_breakdown')
                    .eq('order_id', orderId)
                    .eq('status', 'approved')
                    .single();

                emailService.send('REFUND_INITIATED', orderWithUser.profiles.email, {
                    customerName: orderWithUser.profiles.name,
                    order: { id: orderId, order_number: finalOrder.order_number },
                    refundBreakdown: returnReq?.refund_breakdown || { totalRefund: returnReq?.refund_amount || 0 }
                }, orderWithUser.user_id, orderId)
                    .catch(err => logger.error(`[Order ${orderId}] Failed to send refund email:`, err.message));

                // Log financial event
                FinancialEventLogger.logRefundInitiated(orderId, returnReq?.refund_breakdown || { totalRefund: returnReq?.refund_amount })
                    .catch(err => logger.error(`[Order ${orderId}] Failed to log refund event:`, err.message));
            }
        }

        // 9. Log order status update for audit
        FinancialEventLogger.logOrderUpdated(orderId, previousStatus, newStatus, isAdminOrManager ? userId : null)
            .catch(err => logger.warn(`[Order ${orderId}] Failed to log status update:`, err.message));

        return { success: true, order: finalOrder, refundInitiated };

    } catch (error) {
        logger.error({ err: error }, 'Error in updateOrderStatus:');
        return { success: false, status: 500, error: error.message };
    }
}

/**
 * Get all orders with filtering and pagination
 */
async function getAllOrders(user, {
    orderNumber,
    all,
    page = 1,
    limit = 12,
    status,
    payment_status,
    startDate,
    endDate
}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Start building query
    let query = supabase
        .from('orders')
        .select('id, order_number, totalAmount, status, paymentStatus, createdAt, user_id, items', { count: 'exact' })
        .order('createdAt', { ascending: false });

    // Admin/Manager logic
    if (user.role === 'admin' || user.role === 'manager') {
        if (all !== 'true') {
            query = query.eq('user_id', user.id);
        }
        if (orderNumber) {
            query = query.ilike('order_number', `%${orderNumber}%`);
        }
    } else {
        // Customers ONLY see their own orders
        query = query.eq('user_id', user.id);
        if (orderNumber) {
            query = query.ilike('order_number', `%${orderNumber}%`);
        }
    }

    // Apply Common Filters
    if (status && status !== 'all') {
        query = query.eq('status', status);
    }
    if (payment_status && payment_status !== 'all') {
        query = query.eq('paymentStatus', payment_status);
    }
    if (startDate) {
        query = query.gte('createdAt', startDate);
    }
    if (endDate) {
        query = query.lte('createdAt', endDate);
    }

    // Apply Pagination
    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) throw error;

    // Fetch profiles manually
    const userIds = [...new Set(orders.map(o => o.user_id).filter(id => id))];
    let profilesMap = {};
    if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', userIds);

        if (!profileError && profiles) {
            profilesMap = profiles.reduce((acc, profile) => {
                acc[profile.id] = profile;
                return acc;
            }, {});
        }
    }

    // Attach profile info
    const ordersWithProfiles = orders.map(order => ({
        ...order,
        user: profilesMap[order.user_id] || { name: 'Unknown', email: 'N/A' },
        customer_name: (profilesMap[order.user_id]?.name) || order.customerName || 'Unknown',
        total_amount: order.totalAmount || 0,
        total: order.totalAmount || 0,
        status: order.status || 'pending',
        payment_status: order.paymentStatus || 'pending',
        created_at: order.createdAt
    }));

    return {
        data: ordersWithProfiles,
        meta: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / limit)
        }
    };
}

/**
 * Create a new order
 */
async function createOrder(userId, orderData, userEmail, userName) {
    // Enforce user_id matching token
    orderData.user_id = userId;
    orderData.status = ORDER_STATUS.PENDING;

    const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

    if (error) throw error;

    // Log initial creation status
    await logStatusHistory(data.id, ORDER_STATUS.PENDING, userId, 'Order created');

    // Send Confirmation Email
    const customerEmail = orderData.customer_email || orderData.customerEmail || userEmail;
    const customerNameVal = orderData.customer_name || orderData.customerName || userName || 'Customer';

    logger.info({ orderId: data.id, hasEmail: !!customerEmail, itemsCount: data.items?.length }, 'Sending order confirmation email');

    if (customerEmail) {
        emailService.sendOrderConfirmationEmail(
            customerEmail,
            {
                order: data,
                customerName: customerNameVal
            },
            userId
        )
            .then(res => logger.info({ orderId: data.id }, 'Order confirmation email sent'))
            .catch(err => logger.error({ err }, 'Failed to send order confirmation email'));
    } else {
        logger.warn('No customer email found, skipping confirmation email');
    }

    return data;
}

/**
 * Get single order by ID with details
 */
async function getOrderById(id, user) {
    logger.info({ orderId: id }, 'Fetching order details (v4 - restored roles)');
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_status_history (
                status,
                notes,
                created_at,
                updated_by,
                updater:profiles!order_status_history_updated_by_profile_fk (
                    first_name,
                    last_name,
                    email,
                    role_data:roles (
                        name
                    )
                )
            )
        `)
        .eq('id', id)
        .single();

    if (error) throw error;
    if (!data) {
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
    }

    // Access Control
    const isOwner = user.id === data.user_id;
    const isAdminOrManager = ['admin', 'manager'].includes(user.role);

    if (!isOwner && !isAdminOrManager) {
        const err = new Error('Unauthorized access to this order');
        err.status = 403;
        throw err;
    }

    // Fetch related data in parallel
    const promises = [];

    // 1. Profile
    if (data.user_id) {
        promises.push(
            supabase.from('profiles').select('full_name, email, phone').eq('id', data.user_id).single()
                .then(({ data }) => ({ type: 'profile', data }))
        );
    }
    // 2. Shipping Address
    if (data.shipping_address_id) {
        promises.push(
            supabase.from('addresses').select(`*, phone_numbers (phone_number)`).eq('id', data.shipping_address_id).single()
                .then(({ data }) => ({ type: 'shipping', data }))
        );
    }
    // 3. Billing Address
    if (data.billing_address_id) {
        promises.push(
            supabase.from('addresses').select(`*, phone_numbers (phone_number)`).eq('id', data.billing_address_id).single()
                .then(({ data }) => ({ type: 'billing', data }))
        );
    }
    // 4. Payment Details (Separate query to avoid ambiguous join)
    if (data.payment_id) {
        promises.push(
            supabase.from('payments').select('razorpay_payment_id, method, status').eq('id', data.payment_id).single()
                .then(({ data }) => ({ type: 'payment', data }))
        );
    }

    // 5. Email Logs (Admin/Manager only)
    if (isAdminOrManager) {
        promises.push(
            supabase.from('email_notifications')
                .select('*')
                .eq('order_id', id) // Ensure email_notifications table has order_id column populated!
                .order('created_at', { ascending: false })
                .then(({ data }) => ({ type: 'email_logs', data }))
        );
    }

    const results = await Promise.all(promises);
    let profile = {}, dbShippingAddress = null, dbBillingAddress = null, paymentDetails = null, emailLogs = [];

    results.forEach(res => {
        if (res.type === 'profile' && res.data) profile = res.data;
        if (res.type === 'shipping') dbShippingAddress = res.data;
        if (res.type === 'billing') dbBillingAddress = res.data;
        if (res.type === 'payment') paymentDetails = res.data;
        if (res.type === 'email_logs') emailLogs = res.data || [];
    });

    // Process Addresses
    let shippingAddress = data.shippingAddress || data.shipping_address;
    if (dbShippingAddress && (!shippingAddress || !shippingAddress.phone)) {
        shippingAddress = formatAddress(dbShippingAddress);
    } else {
        shippingAddress = formatAddress(shippingAddress);
    }

    let billingAddress = data.billingAddress || data.billing_address;
    if (dbBillingAddress && (!billingAddress || !billingAddress.phone)) {
        billingAddress = formatAddress(dbBillingAddress);
    } else {
        billingAddress = formatAddress(billingAddress);
    }

    // Map items
    const mappedItems = (data.items || []).map(item => {
        const productInfo = item.products || item.product || item;
        return {
            ...item,
            product: {
                id: productInfo.id || item.product_id,
                title: productInfo.title || item.title || "Product",
                price: productInfo.price || item.price || 0,
                images: productInfo.images || item.images || [],
                isReturnable: productInfo.isReturnable ?? productInfo.is_returnable ?? true
            }
        };
    });

    return {
        ...data,
        customer_name: profile.full_name || data.customerName || 'Unknown',
        customer_email: profile.email || data.customerEmail || data.customer_email || data.user_email,
        customer_phone: profile.phone || data.customerPhone || data.customer_phone || data.user_phone,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        items: mappedItems,
        created_at: data.created_at || data.createdAt,
        total_amount: data.total_amount || data.totalAmount || data.total || 0,
        total_amount: data.total_amount || data.totalAmount || data.total || 0,
        payment_status: data.payment_status || data.paymentStatus || 'pending',
        // Return readable Razorpay ID if available, otherwise internal ID
        payment_id: paymentDetails?.razorpay_payment_id || data.payment_id,
        payment_id: paymentDetails?.razorpay_payment_id || data.payment_id,
        payment_method: paymentDetails?.method,
        email_logs: emailLogs
    };
}

/**
 * Cancel order
 */
async function cancelOrder(id, userId, reason, userEmail, userName) {
    // 1. Verify Ownership
    const { data: order, error } = await supabase
        .from('orders')
        .select('user_id, status, customerEmail, customerName')
        .eq('id', id)
        .single();

    if (error || !order) {
        logger.error({ err: error, orderId: id }, 'Error fetching order for cancellation');
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
    }

    if (order.user_id !== userId) {
        const err = new Error('Unauthorized access to this order');
        err.status = 403;
        throw err;
    }

    // 2. Check Eligibility
    const allowedStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED];
    if (!allowedStatuses.includes(order.status)) {
        const err = new Error('Order cannot be cancelled at this stage');
        err.status = 400;
        throw err;
    }

    // 3. Update Status
    const note = reason ? `Cancelled by user: ${reason}` : 'Cancelled by user';
    const result = await updateOrderStatus(id, ORDER_STATUS.CANCELLED, userId, note);

    if (!result.success) {
        throw new Error(result.error);
    }

    // Send Cancellation Email
    const customerEmail = result.order.customerEmail || result.order.customer_email || userEmail;
    if (customerEmail) {
        emailService.sendOrderStatusUpdateEmail(
            customerEmail,
            {
                order: result.order,
                customerName: result.order.customerName || result.order.customer_name || userName,
                newStatus: 'cancelled'
            },
            userId
        ).catch(err => logger.error({ err }, 'Failed to send cancellation email'));
    }

    return {
        order: result.order,
        refundInitiated: result.refundInitiated || false
    };
}

/**
 * Request Return
 */
async function requestReturn(id, userId, reason, returnItems) {
    // 1. Verify Ownership & Status
    const { data: order, error } = await supabase
        .from('orders')
        .select('user_id, status')
        .eq('id', id)
        .single();

    if (error || !order) {
        const err = new Error('Order not found');
        err.status = 404;
        throw err;
    }

    if (order.user_id !== userId) {
        const err = new Error('Unauthorized access to this order');
        err.status = 403;
        throw err;
    }

    if (order.status !== ORDER_STATUS.DELIVERED) {
        const err = new Error('Only delivered orders can be returned');
        err.status = 400;
        throw err;
    }

    // 2. Store Return Details
    if (returnItems) {
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                return_request: {
                    reason: reason,
                    items: returnItems,
                    requested_at: new Date().toISOString()
                }
            })
            .eq('id', id);

        if (updateError) {
            logger.error({ err: updateError, orderId: id }, 'Error saving return details');
        }
    }

    // 3. Update Status
    const note = reason ? `Return requested: ${reason}` : 'Return requested by user';
    const result = await updateOrderStatus(id, ORDER_STATUS.RETURN_REQUESTED, userId, note);

    if (!result.success) {
        throw new Error(result.error);
    }

    return result.order;
}

module.exports = {
    ORDER_STATUS,
    ALLOWED_TRANSITIONS,
    isValidTransition,
    logStatusHistory,
    updateOrderStatus,
    getAllOrders,
    createOrder,
    getOrderById,
    cancelOrder,
    requestReturn
};
