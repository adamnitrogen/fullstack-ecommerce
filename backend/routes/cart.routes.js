const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate.middleware');
const { addToCartSchema, updateCartSchema, applyCouponSchema } = require('../schemas/cart.schema');
const {
    getUserCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    applyCouponToCart,
    removeCouponFromCart,
    calculateCartTotals,
    clearCart
} = require('../services/cart.service');
const logger = require('../utils/logger');

/**
 * Cart Routes
 * User-authenticated endpoints for managing shopping cart
 * Note: All routes require authentication and use user_id from auth middleware or header
 */

const { authenticateToken } = require('../middleware/auth.middleware');

// Apply authentication to all cart routes
router.use(authenticateToken);

// Helper to get user ID (from auth middleware or header)
const getUserId = (req) => {
    return req.user?.id || req.headers['x-user-id'];
};

// Get user's cart with items and totals
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const cart = await getUserCart(userId);
        const totals = await calculateCartTotals(userId);

        res.json({
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching cart');
        res.status(500).json({ error: error.message });
    }
});

// Add item to cart
router.post('/items', validate(addToCartSchema), async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { product_id, quantity } = req.body;
        // Validation handled by middleware

        const cart = await addToCart(userId, product_id, quantity);
        const totals = await calculateCartTotals(userId);

        res.json({
            message: 'Item added to cart',
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error adding to cart');
        res.status(500).json({ error: error.message });
    }
});

// Update cart item quantity
router.put('/items/:product_id', validate(updateCartSchema), async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { product_id } = req.params;
        const { quantity } = req.body;

        const cart = await updateCartItem(userId, product_id, quantity);
        const totals = await calculateCartTotals(userId);

        res.json({
            message: 'Cart updated',
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error updating cart item');
        res.status(500).json({ error: error.message });
    }
});

// Remove item from cart
router.delete('/items/:product_id', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { product_id } = req.params;
        // We could also validate param UUID using Zod if strictly needed, but route matching helps.

        const cart = await removeFromCart(userId, product_id);
        const totals = await calculateCartTotals(userId);

        res.json({
            message: 'Item removed from cart',
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error removing from cart');
        res.status(500).json({ error: error.message });
    }
});

// Apply coupon to cart
router.post('/apply-coupon', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Coupon code is required' });
        }

        const result = await applyCouponToCart(userId, code);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const totals = await calculateCartTotals(userId);

        res.json({
            message: result.message,
            cart: result.cart,
            coupon: result.coupon,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error applying coupon');
        res.status(500).json({ error: error.message });
    }
});

// Remove coupon from cart
router.delete('/coupon', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const cart = await removeCouponFromCart(userId);
        const totals = await calculateCartTotals(userId);

        res.json({
            message: 'Coupon removed',
            cart,
            totals
        });
    } catch (error) {
        logger.error({ err: error }, 'Error removing coupon');
        res.status(500).json({ error: error.message });
    }
});

// Calculate cart totals (with delivery and discounts)
router.post('/calculate', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const totals = await calculateCartTotals(userId);

        res.json(totals);
    } catch (error) {
        logger.error({ err: error }, 'Error calculating cart totals');
        res.status(500).json({ error: error.message });
    }
});

// Clear cart (after order is placed)
router.delete('/', async (req, res) => {
    try {
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        await clearCart(userId);

        res.json({ message: 'Cart cleared successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error clearing cart');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
