const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');

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
    if (!['delivered', 'return_rejected'].includes(order.status)) {
        throw new Error('Order must be delivered or have a rejected return to request a return');
    }

    // 2. Fetch Order Items
    const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    // 3. Filter Returnable Items
    // Must exclude items that are already in a PENDING return request to avoid double dipping
    const { data: pendingReturns, error: pendingError } = await supabase
        .from('returns')
        .select(`
            id,
            return_items (
                order_item_id,
                quantity
            )
        `)
        .eq('order_id', orderId)
        .eq('status', 'requested'); // Only check pending/requested

    if (pendingError) throw pendingError;

    // Map pending quantities
    const pendingQuantityMap = {};
    if (pendingReturns) {
        pendingReturns.forEach(ret => {
            if (ret.return_items) {
                ret.return_items.forEach(ri => {
                    pendingQuantityMap[ri.order_item_id] = (pendingQuantityMap[ri.order_item_id] || 0) + ri.quantity;
                });
            }
        });
    }

    // Filter logic: (quantity - returned_quantity - pending_quantity) > 0
    const returnableItems = items.filter(item => {
        const pendingQty = pendingQuantityMap[item.id] || 0;
        const available = item.quantity - item.returned_quantity - pendingQty;
        return item.is_returnable && available > 0;
    }).map(item => {
        const pendingQty = pendingQuantityMap[item.id] || 0;
        return {
            ...item,
            remaining_quantity: item.quantity - item.returned_quantity - pendingQty
        };
    });

    return returnableItems;
};

// Helper to log history
const logStatusHistory = async (orderId, status, userId, notes = null) => {
    await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: status,
        updated_by: userId, // Assuming UUID
        notes: notes,
        created_at: new Date().toISOString()
    });
};

const createReturnRequest = async (userId, orderId, returnItems, reason) => {
    // 1. Validate Returnable Items
    const availableItems = await getReturnableItems(orderId, userId);

    // Check if requested items are valid
    for (const reqItem of returnItems) {
        const validItem = availableItems.find(i => i.id === reqItem.orderItemId);
        if (!validItem) throw new Error(`Item ${reqItem.orderItemId} is not eligible for return`);
        if (reqItem.quantity > validItem.remaining_quantity) {
            throw new Error(`Requested quantity ${reqItem.quantity} exceeds returnable quantity for item ${validItem.title}`);
        }
    }

    // 2. Calculate Refund Amount (Estimate)
    let estimatedRefund = 0;
    returnItems.forEach(reqItem => {
        const validItem = availableItems.find(i => i.id === reqItem.orderItemId);
        estimatedRefund += validItem.price_per_unit * reqItem.quantity;
    });

    // 3. Create Return Record
    const { data: returnRequest, error: createError } = await supabase
        .from('returns')
        .insert({
            order_id: orderId,
            user_id: userId,
            status: 'requested',
            refund_amount: estimatedRefund,
            reason: reason
        })
        .select()
        .single();

    if (createError) throw createError;

    // 4. Create Return Items
    const returnItemsData = returnItems.map(item => ({
        return_id: returnRequest.id,
        order_item_id: item.orderItemId,
        quantity: item.quantity
    }));

    const { error: itemsInsertError } = await supabase
        .from('return_items')
        .insert(returnItemsData);

    if (itemsInsertError) throw itemsInsertError;

    // 5. Update Order Status to 'return_requested' if not already
    await supabase
        .from('orders')
        .update({ status: 'return_requested' })
        .eq('id', orderId);

    // 6. Log History
    await logStatusHistory(orderId, 'return_requested', userId, `Return requested for items: ${returnItems.map(i => i.quantity + 'x Item').join(', ')}. Reason: ${reason}`);

    return returnRequest;
};

const processReturnApproval = async (returnId, adminId) => {
    // 1. Fetch Return Details with Items
    const { data: returnRequest, error: fetchError } = await supabase
        .from('returns')
        .select(`
            *,
            orders (
                payment_id,
                paymentStatus
            ),
            return_items (
                quantity,
                order_item_id,
                order_items (
                    price_per_unit,
                    product_id,
                    quantity,
                    returned_quantity
                )
            )
        `)
        .eq('id', returnId)
        .single();

    if (fetchError || !returnRequest) throw new Error('Return request not found');
    if (returnRequest.status !== 'requested') throw new Error('Return request is not in requested state');

    // 2. Calculate Final Refund Amount
    let refundAmount = 0;
    const itemsToUpdate = [];

    for (const item of returnRequest.return_items) {
        refundAmount += item.order_items.price_per_unit * item.quantity;
        itemsToUpdate.push({
            id: item.order_item_id,
            returned_quantity: item.order_items.returned_quantity + item.quantity
        });
    }

    // 3. Update Status (Status update only, refund happens on physical return verification)

    // B. Logs
    logger.info(`Return Approved: ID=${returnId}, Order=${returnRequest.order_id}`);

    // B. Update Return Status
    await supabase.from('returns').update({
        status: 'approved',
        updated_at: new Date().toISOString()
    }).eq('id', returnId);

    // C. Update Order Items returned_quantity
    for (const update of itemsToUpdate) {
        await supabase
            .from('order_items')
            .update({ returned_quantity: update.returned_quantity })
            .eq('id', update.id);
    }

    // D. Update Order Status (Check if all items returned? For now set to return_approved)
    // Optional: Check if full order is returned to set 'returned' or 'refunded'.
    // Keeping simple: set to return_approved.
    // D. Update Order Status
    await supabase
        .from('orders')
        .update({
            status: 'return_approved'
            // paymentStatus remains 'paid' until actual refund on 'returned' status
        })
        .eq('id', returnRequest.order_id);

    // E. Log History
    await logStatusHistory(returnRequest.order_id, 'return_approved', adminId, `Return approved. Waiting for return.`);

    return { success: true };
};

const processReturnRejection = async (returnId, adminId, reason) => {
    const { error } = await supabase
        .from('returns')
        .update({
            status: 'rejected',
            staff_notes: reason,
            updated_at: new Date().toISOString()
        })
        .eq('id', returnId);

    if (error) throw error;

    // Update order status back to delivered or return_rejected
    // User flow: Admin rejects -> RETURN_REJECTED

    // Fetch orderId
    const { data: ret } = await supabase.from('returns').select('order_id').eq('id', returnId).single();

    if (ret) {
        await supabase
            .from('orders')
            .update({ status: 'return_rejected' })
            .eq('id', ret.order_id);

        await logStatusHistory(ret.order_id, 'return_rejected', adminId, `Return rejected. Reason: ${reason}`);
    }

    return { success: true };
};

const getActiveReturnRequest = async (orderId) => {
    const { data: returnRequest, error } = await supabase
        .from('returns')
        .select(`
            *,
            return_items (
                quantity,
                order_item_id,
                order_items (
                    title,
                    price_per_unit,
                    product_id
                )
            )
        `)
        .eq('order_id', orderId)
        .in('status', ['requested', 'approved', 'rejected']) // Fetch any recent return to show history if needed
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
    return returnRequest;
};

module.exports = {
    getReturnableItems,
    createReturnRequest,
    processReturnApproval,
    processReturnRejection,
    getActiveReturnRequest
};
