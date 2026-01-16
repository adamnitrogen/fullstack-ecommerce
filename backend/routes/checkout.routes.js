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
    createRazorpayInvoice,
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

        const { addressId } = req.query;
        const summary = await getCheckoutSummary(userId, addressId);
        res.json(summary);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching checkout summary:');
        res.status(500).json({ error: error.message });
    }
});

// Validate stock availability for all cart items before payment
// Returns list of items with insufficient stock
router.get('/validate-stock', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const cartService = require('../services/cart.service');
        const supabase = require('../config/supabase');
        const cart = await cartService.getUserCart(userId);

        if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
            return res.json({ valid: true, items: [] });
        }

        const stockIssues = [];

        for (const item of cart.cart_items) {
            const variantId = item.variant_id;
            const productId = item.product_id;
            const requestedQty = item.quantity;

            let availableStock = 0;
            let productTitle = item.products?.title || 'Product';
            let variantLabel = null;

            if (variantId) {
                // Check variant stock
                const { data: variant } = await supabase
                    .from('product_variants')
                    .select('stock_quantity, size_label')
                    .eq('id', variantId)
                    .single();

                availableStock = variant?.stock_quantity || 0;
                variantLabel = variant?.size_label;
            } else {
                // Check product inventory
                const { data: product } = await supabase
                    .from('products')
                    .select('inventory')
                    .eq('id', productId)
                    .single();

                availableStock = product?.inventory || 0;
            }

            if (requestedQty > availableStock) {
                stockIssues.push({
                    productId,
                    variantId,
                    title: productTitle,
                    variantLabel,
                    requestedQty,
                    availableStock,
                    image: item.products?.images?.[0] || null
                });
            }
        }

        res.json({
            valid: stockIssues.length === 0,
            items: stockIssues
        });
    } catch (error) {
        logger.error({ err: error }, 'Error validating stock:');
        res.status(500).json({ error: error.message });
    }
});

// Create Razorpay INVOICE (replaces Order)
// Protected by request lock and idempotency to prevent duplicate invoices
router.post('/create-payment-order', validate(createPaymentOrderSchema), requestLock('create-payment-order'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // 1. Get User Profile (Needed for Invoice)
        // We need name/email/phone for the Invoice Customer
        const { data: profile } = await require('../config/supabase')
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // 2. Get Cart & Totals
        const cartService = require('../services/cart.service');
        const cart = await cartService.getUserCart(userId);
        if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const totals = await cartService.calculateCartTotals(userId, cart);
        const amount = totals.finalAmount;

        // 3. Receipt ID
        const receipt = `order_${Date.now()}_${userId.substring(0, 8)}`;

        // 4. Map Cart Items to Razorpay Line Items
        // This is where "Phase 20" logic shines: Using synced Item IDs
        const lineItems = cart.cart_items.map(item => {
            const variant = item.product_variants;
            const product = item.products;

            if (variant && variant.razorpay_item_id) {
                // Synced Item: Use ID
                return {
                    item_id: variant.razorpay_item_id,
                    quantity: item.quantity
                };
            } else {
                // Unsynced / Old Item: Fallback to manual details
                // (This ensures checkout doesn't break for old products)
                return {
                    name: `${product.title} - ${variant?.size_label || 'Default'}`,
                    amount: Math.round((variant?.selling_price || product.price) * 100),
                    currency: 'INR',
                    quantity: item.quantity
                };
            }
        });

        // Add Delivery Charge as a line item if applicable
        if (totals.deliveryCharge > 0) {
            lineItems.push({
                name: 'Delivery Charge',
                amount: Math.round(totals.deliveryCharge * 100),
                currency: 'INR',
                quantity: 1
            });
        }

        // Add Discount as negative line item? No, Razorpay API handles discounts differently via discount_amount?
        // Or we just rely on the fact that line items should sum up to total?
        // Razorpay Invoices calculate total from line items.
        // Wait. `totals.finalAmount` includes discounts.
        // If we send line items, Razorpay calcualtes the total.
        // If we have coupons, the "Price" of the line items might need to be adjusted OR we add a discount line item (negative amount allowed?).
        // Razorpay Items have fixed amounts (the synced price).
        // If we use `item_id`, the price is fixed to what's in the catalog.
        // If our Cart has a Coupon applied, the user pays LESS than the sum of items.
        // HOW DO WE HANDLE DISCOUNTS with synced Items?
        // Option A: Add a "Discount" line item with negative value (if Razorpay supports it).
        // Option B: Don't use `item_id` if price differs? No, that defeats the purpose of GST sync (tax rate).
        // Option C: Razorpay Invoice API has `discount` param?
        // Let's assume we pass a negative line item for "Coupon Discount".
        // Checking Razorpay docs... "You can add a discount line item with a negative amount".

        if (totals.couponDiscount > 0) {
            lineItems.push({
                name: 'Coupon Discount',
                amount: -Math.round(totals.couponDiscount * 100),
                currency: 'INR',
                quantity: 1
            });
        }

        // 5. Create Razorpay Invoice
        // We pass the Profile details and Line Items
        const razorpayResponse = await createRazorpayInvoice(amount, receipt, profile, lineItems);

        // 6. Create Payment Record
        const payment = await createPaymentRecord({
            user_id: userId,
            razorpay_order_id: razorpayResponse.id, // This is the Order ID (linked to invoice)
            invoice_id: razorpayResponse.invoice_id, // Store Invoice ID for reference
            amount: amount,
            currency: 'INR',
            status: 'created'
        });

        res.json({
            order_id: razorpayResponse.id, // Frontend uses this
            amount: razorpayResponse.amount,
            currency: razorpayResponse.currency,
            payment_id: payment.id,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        logger.error({ err: error }, 'Error creating Razorpay invoice/order:');
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
