
const Razorpay = require('razorpay');
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
const { RefundService, REFUND_TYPES } = require('./refund.service');
const {
    ORDER_STATUS,
    ALLOWED_TRANSITIONS,
    STATUS_MESSAGES,
    isValidTransition,
    logStatusHistory
} = require('./history.service');

/**
 * Centrally manages order status updates including validation, inventory, and logging.
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
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select()
            .single();

        if (updateError) throw updateError;

        // 5. Log History with descriptive message
        const statusMessage = notes || STATUS_MESSAGES[newStatus] || `Status updated to ${newStatus}`;
        const actingRole = (role === 'admin' || role === 'manager') ? 'ADMIN' : 'USER';
        await logStatusHistory(orderId, newStatus, userId, statusMessage, actingRole);

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
                await supabase.from('orders').update({ payment_status: 'refund_initiated' }).eq('id', orderId); // Fix column name too
                await logStatusHistory(orderId, 'refund_initiated', userId, 'Refund Initiated: Your refund will be credited back to your original payment method within 5-7 business days.', actingRole);
                refundInitiated = true;

                // Process actual Razorpay refund in background (non-blocking) using RefundService
                RefundService.asyncProcessRefund(orderId, REFUND_TYPES.BUSINESS_REFUND, userId, 'Cancelled before shipping')
                    .then(refundResult => {
                        if (refundResult?.success) {
                            logger.info(`[Order ${orderId}] Business refund processed successfully via RefundService`);
                        } else {
                            logger.info(`[Order ${orderId}] Refund skipped or failed: ${refundResult.reason}`);
                        }
                    })
                    .catch(refundErr => {
                        logger.error(`[Order ${orderId}] Background refund failed:`, refundErr.message);
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
                            // Execute Refund via RefundService for manual returns
                            const refundResult = await RefundService.asyncProcessRefund(
                                orderId,
                                REFUND_TYPES.BUSINESS_REFUND,
                                userId,
                                'Manual return processed',
                                false,
                                verifiedRefundAmount
                            );

                            if (refundResult?.success) {
                                await supabase.from('refunds').insert({
                                    return_id: returnReq.id,
                                    order_id: orderId,
                                    razorpay_refund_id: refundResult.id,
                                    amount: verifiedRefundAmount,
                                    status: 'processed'
                                });

                                logger.info(`[Order ${orderId}] Verified Refund successfully processed via RefundService.`);
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
            // New Logic: Generate Internal GST Tax Invoice
            // The InvoiceOrchestrator already determines if it should be GST or Non-GST
            InvoiceOrchestrator.generateInternalInvoice(orderId)
                .then(result => {
                    if (result.success) {
                        logger.info(`[Order ${orderId}] Internal Invoice generated: ${result.invoiceId}`);
                    } else {
                        logger.error(`[Order ${orderId}] Invoice generation failed: ${result.error}`);
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
        .select('id, order_number, total_amount, status, payment_status, created_at, user_id, items', { count: 'exact' })
        .order('created_at', { ascending: false });

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
    if (status === 'active_returns') {
        query = query.in('status', ['return_requested', 'return_approved']);
    } else if (status && status !== 'all') {
        query = query.eq('status', status);
    }
    if (payment_status && payment_status !== 'all') {
        query = query.eq('payment_status', payment_status);
    }
    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
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
        customer_name: (profilesMap[order.user_id]?.name) || order.customer_name || 'Unknown',
        total_amount: order.total_amount || 0,
        total: order.total_amount || 0,
        status: order.status || 'pending',
        payment_status: order.payment_status || 'pending',
        created_at: order.created_at
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
                event_type,
                actor,
                notes,
                created_at,
                updated_by,
                updater:profiles (
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

    // Debug Log for History
    if (data && data.order_status_history) {
        logger.info({
            orderId: id,
            historyCount: data.order_status_history.length
        }, 'fetched order_status_history');
    } else {
        logger.warn({ orderId: id }, 'Fetched order but order_status_history is missing or empty');
    }

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
            supabase.from('profiles').select('name, email, phone').eq('id', data.user_id).single()
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
    // 4. Refunds (Fetch separately to avoid PostgREST embedding issues)
    // Try catching errors here gracefully so it doesn't break the whole page
    promises.push(
        supabase.from('refunds')
            .select('id, razorpay_refund_id, amount, status, created_at, reason')
            .eq('order_id', id)
            .then(({ data, error }) => {
                if (error) {
                    logger.warn(`Failed to fetch refunds for order ${id}:`, error);
                    return { type: 'refunds', data: [] };
                }
                return { type: 'refunds', data: data || [] };
            })
    );

    // 4. Payment Details (Fetch with Refunds to handle legacy data without order_id)
    if (data.payment_id) {
        promises.push(
            supabase.from('payments')
                .select('razorpay_payment_id, method, status, invoice_id, refunds(*)')
                .eq('id', data.payment_id)
                .single()
                .then(({ data }) => ({ type: 'payment_with_refunds', data }))
        );
    } else {
        // Fallback: Try to find payment linked to this order
        promises.push(
            supabase.from('payments')
                .select('razorpay_payment_id, method, status, invoice_id, refunds(*)')
                .eq('order_id', id)
                .single()
                .then(({ data }) => ({ type: 'payment_with_refunds', data }))
                .catch(() => ({ type: 'payment_with_refunds', data: null }))
        );
    }

    // 6. Invoices (Fetch separately)
    promises.push(
        supabase.from('invoices')
            .select('id, type, invoice_number, public_url, status, created_at')
            .eq('order_id', id)
            .then(({ data }) => ({ type: 'invoices', data: data || [] }))
            .catch(err => {
                logger.warn({ err }, `Failed to fetch invoices for order ${id}`);
                return { type: 'invoices', data: [] };
            })
    );

    const results = await Promise.all(promises);
    let profile = {}, dbShippingAddress = null, dbBillingAddress = null, paymentDetails = null, emailLogs = [], invoices = [];

    results.forEach(res => {
        if (res.type === 'profile' && res.data) profile = res.data;
        if (res.type === 'shipping') dbShippingAddress = res.data;
        if (res.type === 'billing') dbBillingAddress = res.data;
        if (res.type === 'refunds') {
            // Merge parallel fetched refunds (if any)
            data.refunds = [...(data.refunds || []), ...res.data];
        }
        if (res.type === 'invoices') invoices = res.data;
        if (res.type === 'payment_with_refunds' && res.data) {
            paymentDetails = res.data;
            // Hoist nested refunds to top level order object
            if (res.data.refunds && res.data.refunds.length > 0) {
                // Avoid duplicates if we fetched same refunds via order_id
                const existingIds = new Set((data.refunds || []).map(r => r.id));
                const newRefunds = res.data.refunds.filter(r => !existingIds.has(r.id));
                data.refunds = [...(data.refunds || []), ...newRefunds];
            }
        }
        if (res.type === 'email_logs') emailLogs = res.data || [];
    });

    // Fallback: If no Razorpay invoice found in DB, but Payment has an invoice_id, fetch it live
    // This repairs missing invoices due to previous bugs or sync issues
    const hasRazorpayInvoice = invoices.some(i => i.type === 'RAZORPAY');
    if (!hasRazorpayInvoice && paymentDetails?.invoice_id) {
        try {
            const key_id = process.env.RAZORPAY_KEY_ID;
            const key_secret = process.env.RAZORPAY_KEY_SECRET;
            if (key_id && key_secret) {
                const razorpay = new Razorpay({ key_id, key_secret });
                let inv = await razorpay.invoices.fetch(paymentDetails.invoice_id);

                // Ensure it has a URL (Issue if draft)
                if (inv.status === 'draft') {
                    logger.info(`[Order ${id}] Issuing draft invoice found via fallback logic`);
                    inv = await razorpay.invoices.issue(inv.id);
                }

                if (inv.short_url) {
                    const virtualInvoice = {
                        id: inv.id,
                        type: 'RAZORPAY', // Matches frontend expectation
                        invoice_number: inv.invoice_number,
                        public_url: inv.short_url,
                        status: inv.status,
                        created_at: new Date(inv.date * 1000).toISOString()
                    };
                    invoices.push(virtualInvoice);

                    // Self-healing: persist to DB for future speed
                    supabase.from('invoices').insert({
                        order_id: id,
                        type: 'RAZORPAY',
                        invoice_number: inv.invoice_number,
                        provider_id: inv.id,
                        public_url: inv.short_url,
                        status: (inv.status === 'paid' || inv.status === 'issued' || inv.status === 'issued') ? 'GENERATED' : inv.status.toUpperCase()
                    }).then(() => logger.info(`[Order ${id}] Self-healed missing invoice record in DB`))
                        .catch(e => logger.warn(`[Order ${id}] Failed to persist self-healed invoice`, e));
                }
            }
        } catch (e) {
            logger.warn({ err: e, invoiceId: paymentDetails.invoice_id }, 'Failed to fetch fallback invoice from Razorpay');
        }
    }

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
        customer_name: profile.name || data.customer_name || data.customerName || 'Unknown',
        customer_email: profile.email || data.customer_email || data.customerEmail || data.user_email,
        customer_phone: profile.phone || data.customer_phone || data.customerPhone || data.user_phone || shippingAddress?.phone,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        items: mappedItems,
        created_at: data.created_at || data.createdAt,
        total_amount: data.total_amount || data.totalAmount || data.total || 0,
        payment_status: data.payment_status || data.paymentStatus || 'pending',
        // Return readable Razorpay ID if available, otherwise internal ID
        payment_id: paymentDetails?.razorpay_payment_id || data.payment_id,
        payment_method: paymentDetails?.method,
        email_logs: emailLogs,
        // Explicitly pass delivery fields if they exist on order
        delivery_charge: data.delivery_charge || 0,
        delivery_gst: data.delivery_gst || 0,
        refunds: data.refunds || [],
        invoices: invoices
    };
}

/**
 * Cancel order
 */
async function cancelOrder(id, userId, reason, userEmail, userName) {
    // 1. Verify Ownership
    const { data: order, error } = await supabase
        .from('orders')
        .select('user_id, status, customer_email, customer_name')
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
        emailService.sendOrderCancellationEmail(
            customerEmail,
            {
                order: result.order,
                customerName: result.order.customerName || result.order.customer_name || userName
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
    requestReturn,
    // Export logStatusHistory primarily for backward compatibility if required, though now imported directly
    logStatusHistory
};
