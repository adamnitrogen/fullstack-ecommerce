const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const Razorpay = require('razorpay');
const { PricingCalculator } = require('./pricing-calculator.service');
const { RefundCalculator } = require('./refund-calculator.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const { DeliveryChargeService } = require('./delivery-charge.service');
const emailService = require('./email');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('ReturnService');

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

    // Filter logic: (quantity - returned_quantity - pending_quantity) > 0 AND within return window
    const now = new Date();
    const returnableItems = items.filter(item => {
        const pendingQty = pendingQuantityMap[item.id] || 0;
        const available = item.quantity - item.returned_quantity - pendingQty;

        // Check if within return window
        let withinReturnWindow = true;
        if (deliveryDate) {
            const returnDays = item.products?.return_days ?? 7; // Default 7 days if not specified
            const returnDeadline = new Date(deliveryDate.getTime() + (returnDays * 24 * 60 * 60 * 1000));
            withinReturnWindow = now <= returnDeadline;
        }

        return item.is_returnable && available > 0 && withinReturnWindow;
    }).map(item => {
        const pendingQty = pendingQuantityMap[item.id] || 0;
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

    // 2. Calculate Refund Amount with Tax using RefundCalculator
    const refundBreakdown = RefundCalculator.calculateReturnTotal(availableItems, returnItems);
    const estimatedRefund = refundBreakdown.summary.totalRefund;

    log.info('RETURN_REFUND_CALCULATED', 'Calculated refund for return request', {
        orderId,
        estimatedRefund,
        taxRefund: refundBreakdown.summary.totalTaxRefund
    });

    // 3. Create Return Record
    const { data: returnRequest, error: createError } = await supabase
        .from('returns')
        .insert({
            order_id: orderId,
            user_id: userId,
            status: 'requested',
            refund_amount: estimatedRefund,
            reason: reason,
            // Store tax refund breakdown
            refund_breakdown: refundBreakdown.summary
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

    // 7. Log Financial Event
    FinancialEventLogger.logReturnRequested(orderId, returnRequest.id, returnItems, userId)
        .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log return request', { error: err.message }));

    // 8. Get user email and send RETURN_REQUESTED email
    const { data: order } = await supabase
        .from('orders')
        .select('user_id, profiles(email, name)')
        .eq('id', orderId)
        .single();

    if (order?.profiles?.email) {
        emailService.send('RETURN_REQUESTED', order.profiles.email, {
            customerName: order.profiles.name,
            order: { id: orderId, order_number: orderId.slice(0, 8).toUpperCase() },
            returnItems: returnItems.map((ri, i) => ({
                title: availableItems.find(a => a.id === ri.orderItemId)?.title || 'Product',
                quantity: ri.quantity,
                variantLabel: availableItems.find(a => a.id === ri.orderItemId)?.variant_snapshot?.size_label
            })),
            reason
        }, userId, returnRequest.id).catch(err => log.warn('EMAIL_ERROR', 'Failed to send return requested email', { error: err.message }));
    }

    return returnRequest;
};

const processReturnApproval = async (returnId, adminId) => {
    // 1. Fetch Return Details with Items and User Info
    const { data: returnRequest, error: fetchError } = await supabase
        .from('returns')
        .select(`
            *,
            orders (
                id,
                payment_id,
                paymentStatus,
                user_id,
                profiles(email, name)
            ),
            return_items (
                quantity,
                order_item_id,
                order_items (
                    price_per_unit,
                    product_id,
                    quantity,
                    returned_quantity,
                    taxable_amount,
                    cgst,
                    sgst,
                    igst,
                    total_amount,
                    delivery_charge,
                    delivery_gst,
                    delivery_calculation_snapshot
                )
            )
        `)
        .eq('id', returnId)
        .single();

    if (fetchError || !returnRequest) throw new Error('Return request not found');
    if (returnRequest.status !== 'requested') throw new Error('Return request is not in requested state');

    // 2. Calculate Final Refund Amount (use stored breakdown if available)
    const orderItemsData = returnRequest.return_items.map(ri => ({
        ...ri.order_items,
        id: ri.order_item_id
    }));
    const returnItems = returnRequest.return_items.map(ri => ({
        orderItemId: ri.order_item_id,
        quantity: ri.quantity
    }));

    // Calculate product refund
    const refundCalc = RefundCalculator.calculateReturnTotal(orderItemsData, returnItems);
    const productRefundAmount = refundCalc.summary.totalRefund;

    // Calculate delivery refund with policy enforcement
    let deliveryRefundAmount = 0;
    let deliveryGSTRefundAmount = 0;
    let deliveryPolicyDetails = [];

    try {
        const deliveryRefund = await DeliveryChargeService.calculateRefundDelivery(
            orderItemsData,
            returnItems
        );

        deliveryRefundAmount = deliveryRefund.refundDeliveryCharge;
        deliveryGSTRefundAmount = deliveryRefund.refundDeliveryGST;
        deliveryPolicyDetails = deliveryRefund.policyDetails;

        log.info('RETURN_DELIVERY_REFUND', 'Delivery refund calculated', {
            refundDelivery: deliveryRefundAmount,
            refundDeliveryGST: deliveryGSTRefundAmount,
            isRefundable: deliveryRefund.isRefundable
        });
    } catch (error) {
        log.warn('RETURN_DELIVERY_REFUND_ERROR', 'Failed to calculate delivery refund', { error: error.message });
    }

    // Calculate total refund amount including delivery
    const totalRefundAmount = productRefundAmount + deliveryRefundAmount + deliveryGSTRefundAmount;

    // 3. Process Razorpay Refund
    const { data: payment } = await supabase
        .from('payments')
        .select('razorpay_payment_id')
        .eq('id', returnRequest.orders.payment_id)
        .single();

    if (!payment?.razorpay_payment_id) {
        throw new Error('Razorpay payment ID not found for this order');
    }

    log.info('RAZORPAY_REFUND_START', 'Initiating Razorpay refund', {
        paymentId: payment.razorpay_payment_id,
        amount: totalRefundAmount
    });

    const refund = await razorpay.payments.refund(
        payment.razorpay_payment_id,
        {
            amount: Math.round(totalRefundAmount * 100), // Amount in paise
            notes: {
                return_id: returnId,
                product_refund: productRefundAmount,
                delivery_refund: deliveryRefundAmount,
                delivery_gst_refund: deliveryGSTRefundAmount,
                delivery_policies: JSON.stringify(deliveryPolicyDetails.map(p => ({
                    product_id: p.product_id,
                    policy: p.policy
                })))
            }
        }
    );

    // 4. Update Status and Records
    const itemsToUpdate = [];
    for (const item of returnRequest.return_items) {
        itemsToUpdate.push({
            id: item.order_item_id,
            returned_quantity: item.order_items.returned_quantity + item.quantity
        });
    }

    // Update Return Status
    await supabase.from('returns').update({
        status: 'approved',
        refund_amount: totalRefundAmount,
        updated_at: new Date().toISOString()
    }).eq('id', returnId);

    // Create refund log
    await supabase.from('refunds').insert({
        return_id: returnId,
        order_id: returnRequest.order_id,
        razorpay_refund_id: refund.id,
        amount: totalRefundAmount,
        status: refund.status,
        created_at: new Date().toISOString()
    });

    // Update Order Items returned_quantity
    for (const update of itemsToUpdate) {
        await supabase
            .from('order_items')
            .update({ returned_quantity: update.returned_quantity })
            .eq('id', update.id);
    }

    // Update Order Status
    await supabase
        .from('orders')
        .update({ status: 'return_approved' })
        .eq('id', returnRequest.order_id);

    // Log History
    await logStatusHistory(returnRequest.order_id, 'return_approved', adminId, `Return approved and refund of ₹${totalRefundAmount} processed via Razorpay.`);

    // Log Financial Event
    FinancialEventLogger.logReturnApproved(returnId, returnRequest.order_id, adminId, totalRefundAmount)
        .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log return approval', { error: err.message }));

    // Send RETURN_APPROVED Email
    const userEmail = returnRequest.orders?.profiles?.email;
    const userName = returnRequest.orders?.profiles?.name;
    if (userEmail) {
        emailService.send('RETURN_APPROVED', userEmail, {
            customerName: userName,
            order: { id: returnRequest.order_id, order_number: returnRequest.order_id.slice(0, 8).toUpperCase() },
            estimatedRefund: totalRefundAmount
        }, returnRequest.orders?.user_id, returnRequest.id)
            .catch(err => log.warn('EMAIL_ERROR', 'Failed to send return approved email', { error: err.message }));
    }

    return { success: true, refundId: refund.id, amount: totalRefundAmount };
};

const processReturnRejection = async (returnId, adminId, reason) => {
    // Fetch return with user info before updating
    const { data: returnRequest, error: fetchError } = await supabase
        .from('returns')
        .select(`
            order_id,
            orders (
                user_id,
                profiles(email, name)
            )
        `)
        .eq('id', returnId)
        .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
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
        await supabase
            .from('orders')
            .update({ status: 'return_rejected' })
            .eq('id', returnRequest.order_id);

        await logStatusHistory(returnRequest.order_id, 'return_rejected', adminId, `Return rejected. Reason: ${reason}`);

        // Log Financial Event
        FinancialEventLogger.logReturnRejected(returnId, returnRequest.order_id, adminId, reason)
            .catch(err => log.warn('AUDIT_LOG_ERROR', 'Failed to log return rejection', { error: err.message }));

        // Send RETURN_REJECTED Email
        const userEmail = returnRequest.orders?.profiles?.email;
        const userName = returnRequest.orders?.profiles?.name;
        if (userEmail) {
            emailService.send('RETURN_REJECTED', userEmail, {
                customerName: userName,
                order: { id: returnRequest.order_id, order_number: returnRequest.order_id.slice(0, 8).toUpperCase() },
                reason
            }, returnRequest.orders?.user_id, returnId)
                .catch(err => log.warn('EMAIL_ERROR', 'Failed to send return rejected email', { error: err.message }));
        }
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
