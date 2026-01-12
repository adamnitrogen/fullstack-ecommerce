const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const validate = require('../middleware/validate.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');
const { createPaymentOrderSchema, verifyPaymentSchema } = require('../schemas/checkout.schema');
const {
    getCheckoutSummary,
    createRazorpayOrder,
    createPaymentRecord,
    processPaymentAndOrder
} = require('../services/checkout.service');

/**
 * Checkout Routes
 * Handle checkout flow, Razorpay payment, and order creation
 */

// Apply authentication to all checkout routes
router.use(authenticateToken);

// Helper to get user ID
const getUserId = (req) => {
    return req.user?.id || req.headers['x-user-id'];
};

// Get checkout summary (cart + addresses + totals)
router.get('/summary', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const summary = await getCheckoutSummary(userId);
        res.json(summary);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching checkout summary:');
        res.status(500).json({ error: error.message });
    }
});

// Create Razorpay order
// Protected by request lock and idempotency to prevent duplicate payments
router.post('/create-payment-order', validate(createPaymentOrderSchema), requestLock('create-payment-order'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // SECURITY: Ignore client-provided amount. Calculate effective price server-side.
        // This ensures coupons and prices are valid.
        const cart = await require('../services/cart.service').getUserCart(userId);
        if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const totals = await require('../services/cart.service').calculateCartTotals(userId, cart);
        const amount = totals.finalAmount;

        // Generate receipt ID (Max 40 chars)
        // Format: rcpt_TIMESTAMP_USERSUFFIX (13 + 13 + 8 + 6 = ~40)
        // Actually: order_DATE_UserIdPart is safer
        // order_ (6) + Date (13) + _ (1) + UserSub (8) = 28 chars
        const receipt = `order_${Date.now()}_${userId.substring(0, 8)}`;

        // Create Razorpay order
        const razorpayOrder = await createRazorpayOrder(amount, receipt);

        // Create payment record in database
        const payment = await createPaymentRecord({
            user_id: userId,
            razorpay_order_id: razorpayOrder.id,
            amount: amount,
            currency: 'INR',
            status: 'created'
        });

        res.json({
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount, // Return the trusted amount
            currency: razorpayOrder.currency,
            payment_id: payment.id,
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxx'
        });
    } catch (error) {
        logger.error({ err: error }, 'Error creating Razorpay order:');
        res.status(500).json({ error: 'Failed to create payment order' });
    }
});

// Verify payment and complete order
// Protected by request lock and idempotency to prevent duplicate order creation
router.post('/verify-payment', validate(verifyPaymentSchema), requestLock('verify-payment'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Delegate entire flow to service
        const result = await processPaymentAndOrder(userId, req.body);

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error verifying payment:');
        // If error has status, use it
        res.status(error.status || 500).json({ error: error.message || 'Failed to process payment' });
    }
});

module.exports = router;
