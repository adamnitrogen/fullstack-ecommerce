const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const returnService = require('../services/return.service');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

/**
 * GET /api/returns/orders/:orderId/all
 * Get all return requests for a specific order (Admin/User)
 */
router.get('/orders/:orderId/all', authenticateToken, async (req, res) => {
    try {
        const returns = await returnService.getOrderReturnRequests(req.params.orderId);
        res.json(returns);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/cancel
 * User: Cancel a return request (only if status is 'requested')
 */
router.post('/:returnId/cancel', authenticateToken, async (req, res) => {
    try {
        await returnService.cancelReturnRequest(req.params.returnId, req.user.id);
        res.json({ message: 'Return request cancelled successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/status
 * Admin: Update return status (e.g., mark as picked_up)
 */
router.post('/:returnId/status', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { status, notes } = req.body;
        await returnService.updateReturnStatus(req.params.returnId, status, req.user.id, notes);
        res.json({ message: `Return status updated to ${status}` });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/items/:returnItemId/status
 * Admin: Update status of a specific return item (trigggers refund on 'item_returned')
 */
router.post('/items/:returnItemId/status', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { status, notes } = req.body;
        await returnService.updateReturnItemStatus(req.params.returnItemId, status, req.user.id, notes);
        res.json({ message: `Return item status updated to ${status}` });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/returns/orders/:orderId/items
 * Get eligible items for return for a specific order
 */
router.get('/orders/:orderId/items', authenticateToken, async (req, res) => {
    try {
        const items = await returnService.getReturnableItems(req.params.orderId, req.user.id);
        res.json(items);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/request
 * Submit a partial return request
 */
router.post('/request', authenticateToken, async (req, res) => {
    try {
        const { orderId, items, reason } = req.body;
        // items: [{ orderItemId, quantity }]

        if (!orderId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        const returnRequest = await returnService.createReturnRequest(req.user.id, orderId, items, reason);
        res.json({ message: 'Return request submitted successfully', returnRequest });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/approve
 * Admin: Approve return and trigger refund
 */
router.post('/:returnId/approve', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const result = await returnService.processReturnApproval(req.params.returnId, req.user.id);
        res.json({ message: 'Return approved', ...result });
    } catch (error) {
        logger.error({ err: error }, 'Approval Error:');
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/returns/:returnId/reject
 * Admin: Reject return request
 */
router.post('/:returnId/reject', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { reason } = req.body;
        await returnService.processReturnRejection(req.params.returnId, req.user.id, reason);
        res.json({ message: 'Return rejected' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
