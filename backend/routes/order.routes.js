const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const {
    updateOrderStatus,
    getAllOrders,
    createOrder,
    getOrderById,
    cancelOrder,
    requestReturn
} = require('../services/order.service');
const logger = require('../utils/logger');

// Get orders - Admin/Manager can search, Customer sees own
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await getAllOrders(req.user, req.query);
        res.json({
            success: true,
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        logger.error({ err: error }, 'Get orders error');
        res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
});

// Create order - Authenticated users
router.post('/', authenticateToken, async (req, res) => {
    try {
        const orderData = req.body;
        // Fallbacks for user info from Token if not in body
        const userEmail = req.user.email;
        const userName = req.user.full_name;

        const order = await createOrder(req.user.id, orderData, userEmail, userName);
        res.status(201).json(order);
    } catch (error) {
        // Simple error handling
        res.status(500).json({ error: error.message });
    }
});

// Get single order by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await getOrderById(req.params.id, req.user);
        res.json(order);
    } catch (error) {
        logger.error({ err: error, orderId: req.params.id }, 'Error fetching order');
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Update order status - Admin/Manager Only
router.put('/:id/status', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    logger.info({ orderId: id, newStatus: status, userId: req.user.id }, 'Order status update request');

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    const { success, order, error, status: httpStatus, refundInitiated } = await updateOrderStatus(id, status, req.user.id, notes, req.user.role);

    if (!success) {
        logger.error({ orderId: id, error }, 'Order status update failed');
        return res.status(httpStatus || 500).json({ error });
    }

    // Log refund if initiated
    if (refundInitiated) {
        logger.info({ orderId: id }, 'Refund initiated for order');
    }

    logger.debug({ orderId: id }, 'DB update successful, processing side effects');

    res.json({
        success: true,
        order,
        refundInitiated: refundInitiated || false,
        message: refundInitiated
            ? `Order status updated to ${status}. Refund has been initiated.`
            : `Order status updated to ${status}`
    });
});

// Cancel Order - User initiated
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    // Fallbacks
    const userEmail = req.user.email;
    const userName = req.user.full_name;

    try {
        const result = await cancelOrder(id, userId, reason, userEmail, userName);

        res.json({
            success: true,
            order: result.order,
            refundInitiated: result.refundInitiated || false,
            message: result.refundInitiated
                ? 'Order cancelled successfully. Refund has been initiated to your original payment method.'
                : 'Order cancelled successfully'
        });

    } catch (error) {
        logger.error({ err: error, orderId: id }, 'Error cancelling order');
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Request Return - User initiated
router.post('/:id/return', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { reason, returnItems } = req.body;
    const userId = req.user.id;

    try {
        const order = await requestReturn(id, userId, reason, returnItems);

        res.json({
            success: true,
            order: order,
            message: 'Return request submitted successfully'
        });

    } catch (error) {
        logger.error({ err: error, orderId: id }, 'Error requesting return');
        res.status(error.status || 500).json({ error: error.message });
    }
});

module.exports = router;
