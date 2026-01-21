const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const { PricingCalculator } = require('./pricing-calculator.service');
const { RefundCalculator } = require('./refund-calculator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const emailService = require('./email');
const { createModuleLogger } = require('../utils/logging-standards');
const orderService = require('./order.service');

const log = createModuleLogger('ReturnService');
const { logStatusHistory } = require('./history.service');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Return Service
 * Handles partial return logic, validation, and Razorpay refunds
 */

const getReturnableItems = async (orderId, userId) => {
    // 1. Verify Order Ownership & Status
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

    if (orderError || !order) throw new Error('Order not found or access denied');
    const allowedStatuses = [
        'delivered',
        'return_requested',
        'return_rejected',
        'return_approved',
        'pickupscheduled',
        'pickupattempted',
        'pickupcompleted',
        'intransittowarehouse',
        'qcinprogress',
        'qcpassed',
        'qcfailed',
        'return_completed',
        'return_closed'
    ];
    if (!allowedStatuses.includes(order.status)) {
        return []; // Return empty instead of throwing error to avoid frontend noise for non-returnable orders
    }

    // 2. Fetch Order Items with Product return_days
    const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
            *,
            products:product_id (
                return_days
            )
        `)
        .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    // 3. Get delivery date from status history for return window calculation
    const { data: deliveryHistory } = await supabase
        .from('order_status_history')
        .select('created_at')
        .eq('order_id', orderId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    const deliveryDate = deliveryHistory?.created_at
        ? new Date(deliveryHistory.created_at)
        : null;

    // 4. Filter Returnable Items
    // Must exclude items that are already in a PENDING or COMPLETED return request to avoid double dipping
    const { data: existingReturns, error: pendingError } = await supabase
        .from('returns')
        .select(`
            id,
            status,
            return_items (
                order_item_id,
                quantity
            )
        `)
        .eq('order_id', orderId)
        .in('status', ['requested', 'picked_up', 'approved']); // Check requested, picked up, and approved quantities

    if (pendingError) throw pendingError;

    // Filter logic: (quantity - returned_quantity - existing_quantity) > 0 AND within return window
    // Note: returned_quantity in order_items is updated AFTER approval. 
    // To be safe, we subtract any 'requested' or 'picked_up' quantities.

    const now = new Date();
    const returnableItems = items.filter(item => {
        // Sum up quantities from active (requested/picked_up) returns
        const pendingQty = existingReturns
            ?.filter(r => ['requested', 'picked_up'].includes(r.status))
            ?.reduce((sum, r) => {
                const ri = r.return_items?.find(i => i.order_item_id === item.id);
                return sum + (ri?.quantity || 0);
            }, 0) || 0;

        const available = item.quantity - item.returned_quantity - pendingQty;

        // Check if within return window (from delivery date)
        let withinReturnWindow = true;
        if (deliveryDate) {
            const returnDays = item.products?.return_days ?? 7;
            const returnDeadline = new Date(deliveryDate.getTime() + (returnDays * 24 * 60 * 60 * 1000));
            withinReturnWindow = now <= returnDeadline;
        }

        return item.is_returnable && available > 0 && withinReturnWindow;
    }).map(item => {
        const pendingQty = existingReturns
            ?.filter(r => ['requested', 'picked_up'].includes(r.status))
            ?.reduce((sum, r) => {
                const ri = r.return_items?.find(i => i.order_item_id === item.id);
                return sum + (ri?.quantity || 0);
            }, 0) || 0;

        const returnDays = item.products?.return_days ?? 7;
        let returnDeadline = null;
        if (deliveryDate) {
            returnDeadline = new Date(deliveryDate.getTime() + (returnDays * 24 * 60 * 60 * 1000));
        }
        return {
            ...item,
            remaining_quantity: item.quantity - item.returned_quantity - pendingQty,
            return_days: returnDays,
            return_deadline: returnDeadline?.toISOString() || null
        };
    });

    return returnableItems;
};

// Note: Centralized logStatusHistory from order.service is used instead of local helper

const createReturnRequest = async (userId, orderId, returnItems, reason) => {
    // Note: returnItems is now expected to be an array of objects:
    // { orderItemId, quantity, reason, images: [url1, url2], condition }
    // The 'reason' param at top level is kept for backward compatibility or as a general note,
    // but item-level reasons are preferred.

    // 1. Validate Returnable Items
    const availableItems = await getReturnableItems(orderId, userId);

    // Check if requested items are valid
    for (const reqItem of returnItems) {
        const validItem = availableItems.find(i => i.id === reqItem.orderItemId);
        if (!validItem) throw new Error(`Item ${reqItem.orderItemId} is not eligible for return`);

        if (reqItem.quantity > validItem.remaining_quantity) {
            throw new Error(`Requested quantity ${reqItem.quantity} exceeds returnable quantity for item ${validItem.title}`);
        }

        // Validate Mandatory Fields
        if (!reqItem.reason || reqItem.reason.trim() === '') {
            throw new Error(`Return reason is required for item ${validItem.title}`);
        }

        if (!reqItem.images || !Array.isArray(reqItem.images) || reqItem.images.length < 1) {
            throw new Error(`At least 1 image is required for item ${validItem.title}`);
        }

        if (reqItem.images.length > 3) {
            throw new Error(`Maximum 3 images allowed for item ${validItem.title}`);
        }
    }

    // 2. Calculate Refund Amount with Tax using RefundCalculator
    logger.info({ orderId, itemCount: returnItems.length }, 'Calculating refund for return request');
    const refundBreakdown = RefundCalculator.calculateReturnTotal(availableItems, returnItems);

    // Log items for debugging tax presence
    availableItems.forEach(item => {
        logger.debug({
            itemId: item.id,
            taxable: item.taxable_amount,
            cgst: item.cgst,
            sgst: item.sgst,
            total: item.total_amount
        }, 'Available item tax details');
    });

    logger.info({ summary: refundBreakdown.summary }, 'Calculated product refund breakdown');

    // 2.1 Calculate Delivery Refund using DeliveryChargeService (Selective Refundability)
    let deliveryRefundAmount = 0;
    let deliveryGSTRefundAmount = 0;
    try {
        const deliveryRefund = await DeliveryChargeService.calculateRefundDelivery(
            availableItems,
            returnItems
        );
        deliveryRefundAmount = deliveryRefund.refundDeliveryCharge;
        deliveryGSTRefundAmount = deliveryRefund.refundDeliveryGST;
    } catch (err) {
        log.warn('RETURN_DELIVERY_REFUND_CALC_ERROR', 'Failed to calculate delivery refund during request', { error: err.message });
    }

    const estimatedRefund = refundBreakdown.summary.totalRefund + deliveryRefundAmount + deliveryGSTRefundAmount;

    log.info('RETURN_REFUND_CALCULATED', 'Calculated refund for return request', {
        orderId,
        estimatedRefund,
        productRefund: refundBreakdown.summary.totalRefund,
        deliveryRefund: deliveryRefundAmount + deliveryGSTRefundAmount,
        taxRefund: refundBreakdown.summary.totalTaxRefund
    });

    // 3. Create Return Record
    const { data: returnRequest, error: createError } = await supabaseAdmin
        .from('returns')
        .insert({
            order_id: orderId,
            user_id: userId,
            status: 'requested',
            refund_amount: estimatedRefund,
            reason: reason || 'Item-level reasons provided', // General reason or fallback
            // Store comprehensive refund breakdown
            refund_breakdown: {
                ...refundBreakdown.summary,
                deliveryRefund: deliveryRefundAmount,
                deliveryGSTRefund: deliveryGSTRefundAmount,
                totalDeliveryRefund: deliveryRefundAmount + deliveryGSTRefundAmount
            }
        })
        .select()
        .single();

    if (createError) throw createError;

    // 4. Create Return Items with detailed info
    const returnItemsData = returnItems.map(item => ({
        return_id: returnRequest.id,
        order_item_id: item.orderItemId,
        quantity: item.quantity,
        reason: item.reason,
        images: item.images, // text[] array
        condition: item.condition || 'opened' // Default or passed from frontend
    }));

    const { error: itemsInsertError } = await supabaseAdmin
        .from('return_items')
        .insert(returnItemsData);

    if (itemsInsertError) throw itemsInsertError;

    // 5. Update Order Status to 'return_requested' if not already
    await supabase
        .from('orders')
        .update({ status: 'return_requested' })
        .eq('id', orderId);

    // 6. Log History
    await orderService.logStatusHistory(orderId, 'return_requested', userId, `Return requested. Refund Est: ₹${estimatedRefund}`, 'USER');

    // 7. Log Financial Event
    FinancialEventLogger.logReturnRequested(orderId, returnRequest.id, returnItems, userId)
        .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log return request', { error: err.message }));

    // NO EMAIL: Return requested email is deprecated per email policy
    // Customer can check return status on order details page
    log.info('RETURN_REQUESTED', 'Return request created - email notification disabled per policy', {
        orderId,
        returnId: returnRequest.id,
        estimatedRefund
    });

    return returnRequest;
};

const processReturnApproval = async (returnId, adminId) => {
    // 1. Fetch Return Details
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select(`
            id,
            status,
            order_id,
            user_id,
            orders (
                id,
                order_number,
                profiles(email, name)
            )
        `)
        .eq('id', returnId)
        .single();

    if (fetchError || !returnRequest) throw new Error('Return request not found');
    if (returnRequest.status !== 'requested') {
        throw new Error(`Return request cannot be approved from ${returnRequest.status} state`);
    }

    // 2. Update Statuses
    // Update Return Request status
    await supabaseAdmin.from('returns').update({
        status: 'approved',
        updated_at: new Date().toISOString()
    }).eq('id', returnId);

    // Update all Return Items status to approved
    await supabaseAdmin.from('return_items').update({
        status: 'approved'
    }).eq('return_id', returnId);

    // 3. Update Order Status
    await supabaseAdmin
        .from('orders')
        .update({ status: 'return_approved' })
        .eq('id', returnRequest.order_id);

    // 4. Log History
    await orderService.logStatusHistory(returnRequest.order_id, 'return_approved', adminId, 'Return approved! We will now proceed with picking up the items.', 'ADMIN');

    // NO EMAIL: Return approved email is deprecated per email policy
    // Customer can check return status on order details page
    log.info('RETURN_APPROVED', 'Return approved - email notification disabled per policy', {
        orderId: returnRequest.order_id,
        returnId
    });

    return { success: true };
};

const processReturnRejection = async (returnId, adminId, reason) => {
    // Fetch return with user info before updating
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select(`
            order_id,
            status,
            orders (
                user_id,
                order_number,
                profiles(email, name)
            )
        `)
        .eq('id', returnId)
        .single();

    if (fetchError) throw fetchError;

    const { error } = await supabaseAdmin
        .from('returns')
        .update({
            status: 'rejected',
            staff_notes: reason,
            updated_at: new Date().toISOString()
        })
        .eq('id', returnId);

    if (error) throw error;

    // Update order status back to return_rejected
    if (returnRequest) {
        await supabaseAdmin
            .from('orders')
            .update({ status: 'return_rejected' })
            .eq('id', returnRequest.order_id);

        await orderService.logStatusHistory(returnRequest.order_id, 'return_rejected', adminId, `Return rejected. Reason: ${reason}`, 'ADMIN');

        // Log Financial Event
        FinancialEventLogger.logReturnRejected(returnId, returnRequest.order_id, adminId, reason)
            .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log return rejection', { error: err.message }));

        // NO EMAIL: Return rejected email is deprecated per email policy
        // Customer can check return status on order details page
        log.info('RETURN_REJECTED', 'Return rejected - email notification disabled per policy', {
            orderId: returnRequest.order_id,
            returnId,
            reason
        });
    }

    return { success: true };
};

const cancelReturnRequest = async (returnId, userId) => {
    // 1. Fetch Return Request
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select('*')
        .eq('id', returnId)
        .eq('user_id', userId)
        .single();

    if (fetchError || !returnRequest) throw new Error('Return request not found');

    // 2. Cancellation Check
    // Customers can only cancel if it's in 'requested' status.
    // Fixed: block if picked_up, approved, or rejected.
    if (returnRequest.status !== 'requested') {
        throw new Error(`Cannot cancel return in ${returnRequest.status} state. Picked up items cannot be cancelled.`);
    }

    // 3. Update Return Status to Cancelled
    const { error: updateError } = await supabaseAdmin
        .from('returns')
        .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
        })
        .eq('id', returnId);

    if (updateError) throw updateError;

    // 4. Log History
    await orderService.logStatusHistory(returnRequest.order_id, 'return_cancelled', userId, `Return request cancelled by you.`, 'USER');

    return { success: true };
};

const updateReturnStatus = async (returnId, status, adminId, notes = '') => {
    // 1. Fetch Return Request
    const { data: returnRequest, error: fetchError } = await supabaseAdmin
        .from('returns')
        .select('*')
        .eq('id', returnId)
        .single();

    if (fetchError || !returnRequest) throw new Error('Return request not found');

    // 2. Validate Transition Logic
    const validStatuses = ['approved', 'pickup_scheduled', 'picked_up', 'item_returned', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid return status: ${status}`);
    }

    // 3. Update Status
    const { error: updateError } = await supabaseAdmin
        .from('returns')
        .update({
            status: status,
            staff_notes: notes || returnRequest.staff_notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', returnId);

    if (updateError) throw updateError;

    // 4. Log Status History
    await orderService.logStatusHistory(returnRequest.order_id, `return_${status}`, adminId, `Return request status updated to ${status}. ${notes}`, 'ADMIN');

    // 5. If marking as picked_up, update all items too if they are still 'approved'
    if (status === 'picked_up') {
        await supabaseAdmin
            .from('return_items')
            .update({ status: 'picked_up' })
            .eq('return_id', returnId)
            .eq('status', 'approved');
    }

    return { success: true };
};

/**
 * Marks a specific Return Item as returned at the warehouse/dealer.
 * Triggers the refund for that specific item.
 */
const updateReturnItemStatus = async (returnItemId, status, adminId, notes = '') => {
    // 1. Fetch Item Details with Return information
    const { data: item, error: fetchError } = await supabaseAdmin
        .from('return_items')
        .select(`
            *,
            returns (
                id,
                order_id,
                user_id,
                refund_breakdown
            ),
            order_items (*)
        `)
        .eq('id', returnItemId)
        .single();

    if (fetchError || !item) throw new Error('Return item not found');

    const oldStatus = item.status;
    if (oldStatus === status) return { success: true };

    log.info('UPDATE_RETURN_ITEM_STATUS', `Updating item ${returnItemId} to ${status}`, {
        oldStatus,
        newStatus: status
    });

    // 2. Update Status
    const { error: updateError } = await supabaseAdmin
        .from('return_items')
        .update({ status })
        .eq('id', returnItemId);

    if (updateError) throw updateError;

    // 3. If status is 'item_returned', trigger the refund trigger
    if (status === 'item_returned') {
        await handleItemRefund(item, adminId);
    }

    // 4. Re-aggregate Return Request and Order state
    await aggregateReturnState(item.return_id);
    await aggregateOrderState(item.returns.order_id);

    // 5. Log detailed history for item receipt
    await logStatusHistory(item.returns.order_id, 'ITEM_RETURNED', adminId, `Item received at warehouse: ${item.order_items.title} (Qty: ${item.quantity})`, 'ADMIN', 'ITEM_RETURNED');

    return { success: true };
};

/**
 * Handle specific item refund via Razorpay
 */
const handleItemRefund = async (item, adminId) => {
    const returnId = item.return_id;
    const orderId = item.returns.order_id;

    // 1. Calculate specific item refund amount
    // If it's a partial return, we use the price_per_unit * quantity
    // Tax and Delivery should be handled correctly based on the breakdown

    // Check if identifying as fully returned in order_items
    const newReturnedQty = item.order_items.returned_quantity + item.quantity;

    // Idempotency: skip if we've already refunded this specific return_item
    const { data: existingRefund } = await supabaseAdmin
        .from('refunds')
        .select('id')
        .eq('return_id', returnId)
        .eq('status', 'processed')
        .eq('metadata->return_item_id', item.id)
        .maybeSingle();

    if (existingRefund) {
        log.warn('REFUND_IDEMPOTENCY_BLOCK', 'Refund already exists for this return item', { returnItemId: item.id });
        return;
    }

    // Calculate product refund for this item
    const itemSubtotal = item.order_items.price_per_unit * item.quantity;
    const itemCGST = (item.order_items.cgst / item.order_items.quantity) * item.quantity;
    const itemSGST = (item.order_items.sgst / item.order_items.quantity) * item.quantity;
    const itemIGST = (item.order_items.igst / item.order_items.quantity) * item.quantity;

    let refundAmount = itemSubtotal + itemCGST + itemSGST + itemIGST;

    // Check if this is the LAST item of the return request 
    // If so, we might want to attach the delivery refund if not already done.
    const { data: otherItems } = await supabaseAdmin
        .from('return_items')
        .select('status')
        .eq('return_id', returnId)
        .neq('id', item.id);

    const allOthersReturned = otherItems.every(oi => oi.status === 'item_returned');
    if (allOthersReturned) {
        const totalDeliveryRefund = item.returns.refund_breakdown?.totalDeliveryRefund || 0;
        // In a real system, we might want to track if delivery refund was already processed.
        // For simplicity, we add it to the last item's refund.
        refundAmount += totalDeliveryRefund;
    }

    // 2. Fetch Razorpay Payment ID
    const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('razorpay_payment_id')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!payment?.razorpay_payment_id) throw new Error('Payment ID not found');

    // 3. Initiate Razorpay Refund
    log.info('RAZORPAY_REFUND_INIT', `Refunding ₹${refundAmount} for item ${item.id}`, { paymentId: payment.razorpay_payment_id });

    const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
        amount: Math.round(refundAmount * 100),
        notes: {
            return_id: returnId,
            return_item_id: item.id,
            order_id: orderId
        }
    });

    // 4. Log Refund and Update Order Item
    await supabaseAdmin.from('refunds').insert({
        return_id: returnId,
        order_id: orderId,
        razorpay_refund_id: refund.id,
        amount: refundAmount,
        status: refund.status,
        metadata: { return_item_id: item.id }
    });

    await supabaseAdmin.from('order_items').update({
        returned_quantity: newReturnedQty
    }).eq('id', item.order_item_id);

    // 5. Log detailed refund history
    await logStatusHistory(orderId, 'refund_initiated', adminId, `Refund of ₹${refundAmount.toFixed(2)} processed for item: ${item.order_items.title}. (Razorpay Refund ID: ${refund.id})`, 'ADMIN', 'REFUND_INITIATED');

    log.info('REFUND_SUCCESS', `Refund processed for item ${item.id}`, { refundId: refund.id });
};

/**
 * Aggregates Return Request Status based on items
 */
const aggregateReturnState = async (returnId) => {
    const { data: items } = await supabaseAdmin
        .from('return_items')
        .select('status')
        .eq('return_id', returnId);

    const allReturned = items.every(i => i.status === 'item_returned');
    if (allReturned) {
        await supabaseAdmin.from('returns').update({ status: 'completed' }).eq('id', returnId);
    }
};

/**
 * Aggregates Order Status and Payment Status based on all items and refunds
 */
const aggregateOrderState = async (orderId) => {
    // 1. Calculate Order Status based ONLY on returnable items
    const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('quantity, returned_quantity, products(isReturnable)')
        .eq('order_id', orderId);

    const returnableItems = (orderItems || []).filter(i => i.products?.isReturnable !== false);
    const totalReturnableQty = returnableItems.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalReturnedQty = returnableItems.reduce((s, i) => s + (i.returned_quantity || 0), 0);

    let newStatus = null;
    if (totalReturnedQty > 0) {
        newStatus = (totalReturnedQty >= totalReturnableQty) ? 'returned' : 'partially_returned';
    }

    // 2. Calculate Payment Status
    const { data: refunds } = await supabaseAdmin
        .from('refunds')
        .select('amount')
        .eq('order_id', orderId)
        .eq('status', 'processed');

    const totalRefunded = refunds.reduce((s, r) => s + Number(r.amount), 0);

    // Get original order total
    const { data: order } = await supabaseAdmin
        .from('orders')
        .select('total_amount, payment_status')
        .eq('id', orderId)
        .single();

    let newPaymentStatus = order.payment_status;
    if (totalRefunded > 0) {
        newPaymentStatus = (totalRefunded >= order.total_amount) ? 'refunded' : 'partially_refunded';
    }

    // 3. Update Order
    const updates = {};
    if (newStatus && newStatus !== order.status) updates.status = newStatus;
    if (newPaymentStatus !== order.payment_status) {
        updates.payment_status = newPaymentStatus;
    }

    if (Object.keys(updates).length > 0) {
        const updateData = { ...updates };
        // If the order status is 'returned', ensure payment_status is 'refunded'
        if (updates.status === 'returned') {
            updateData.payment_status = 'refunded';
        }

        await supabaseAdmin.from('orders').update(updateData).eq('id', orderId);

        if (updates.status) {
            const statusLabel = updates.status.replace('_', ' ');
            const message = updates.status === 'returned'
                ? 'All returnable items have been successfully received and refunded. Order status updated to Returned.'
                : `Some items have been returned and refunded. Order status updated to Partially Returned.`;

            await orderService.logStatusHistory(orderId, updates.status, 'SYSTEM', message, 'SYSTEM');
        } else if (updates.payment_status) {
            // Log payment status change if only payment status changed
            await orderService.logStatusHistory(orderId, updates.payment_status, 'SYSTEM', `Order payment status automatically updated to ${updates.payment_status} due to item returns.`, 'SYSTEM');
        }
    }
};

const getOrderReturnRequests = async (orderId) => {
    // Fetch ALL return requests for an order to show history
    const { data, error } = await supabase
        .from('returns')
        .select(`
            *,
            return_items (
                id,
                status,
                quantity,
                reason,
                images,
                condition,
                order_item_id,
                order_items (
                    title,
                    price_per_unit,
                    product_id,
                    variant_snapshot
                )
            )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

module.exports = {
    getReturnableItems,
    createReturnRequest,
    processReturnApproval,
    processReturnRejection,
    cancelReturnRequest,
    updateReturnStatus,
    getOrderReturnRequests,
    updateReturnItemStatus
};
