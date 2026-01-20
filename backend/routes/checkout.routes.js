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
    return req.user?.id;
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

        // PHASE 2B OPTIMIZATION: Include Razorpay key in summary (one less data point in payment order response)
        summary.razorpay_key_id = process.env.RAZORPAY_KEY_ID;

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
// NOW INCLUDES INLINE STOCK VALIDATION (Phase 2B Optimization)
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

        // PHASE 2B OPTIMIZATION: Inline stock validation (eliminates separate API call)
        const supabase = require('../config/supabase');
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

        // Return user-friendly error if stock insufficient
        if (stockIssues.length > 0) {
            return res.status(400).json({
                error: 'Some items in your cart are out of stock. Please review and update your cart.',
                stockIssues
            });
        }

        // 3. Receipt ID
        const receipt = `order_${Date.now()}_${userId.substring(0, 8)}`;

        // 4. Map Cart Items to Razorpay Line Items
        // This is where "Phase 20" logic shines: Using synced Item IDs
        const lineItems = cart.cart_items.map((item, index) => {
            const variant = item.product_variants;
            const product = item.products;

            let razorpayItem;
            if (variant && variant.razorpay_item_id) {
                // Synced Item: Use ID
                razorpayItem = {
                    item_id: variant.razorpay_item_id,
                    name: `${product.title} - ${variant?.size_label || 'Default'}`,
                    amount: Math.round((variant?.selling_price || product.price) * 100),
                    currency: 'INR',
                    quantity: item.quantity
                };
            } else {
                // Unsynced / Old Item: Fallback to manual details
                // (This ensures checkout doesn't break for old products)
                razorpayItem = {
                    name: `${product.title} - ${variant?.size_label || 'Default'}`,
                    amount: Math.round((variant?.selling_price || product.price) * 100),
                    currency: 'INR',
                    quantity: item.quantity
                };
            }

            // Attach delivery metadata to the first item for createRazorpayInvoice to extract
            if (index === 0) {
                razorpayItem.deliveryCharge = totals.deliveryCharge || 0;
                razorpayItem.deliveryGST = totals.deliveryGST || 0;
                razorpayItem.deliveryGSTRate = 18; // Default GST rate for delivery
            }

            return razorpayItem;
        });

        // 5. Create Razorpay Invoice
        // We pass the Profile details, Line Items and Totals for transparency/discount
        const razorpayResponse = await createRazorpayInvoice(amount, receipt, profile, lineItems, totals);

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
        res.status(500).json({ error: error.message || 'Failed to create payment order' });
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

// ============================================
// BUY NOW ENDPOINTS
// These handle checkout for a single item without touching the cart
// ============================================

// Get Buy Now summary (single item + addresses + totals)
router.post('/buy-now/summary', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { productId, variantId, quantity = 1, addressId } = req.body;

        // Validation
        if (!productId) {
            return res.status(400).json({ error: 'Please select a product to continue.' });
        }
        if (quantity < 1 || quantity > 100) {
            return res.status(400).json({ error: 'Please select a valid quantity (1-100).' });
        }

        const { getBuyNowSummary } = require('../services/checkout.service');
        const summary = await getBuyNowSummary(userId, { productId, variantId, quantity }, addressId);

        // PHASE 2B OPTIMIZATION: Include Razorpay key in summary
        summary.razorpay_key_id = process.env.RAZORPAY_KEY_ID;

        res.json(summary);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching buy now summary:');
        res.status(error.status || 500).json({ error: error.message || 'Unable to load checkout details. Please try again.' });
    }
});

// Validate stock for Buy Now item
router.post('/buy-now/validate-stock', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { productId, variantId, quantity = 1 } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'Please select a product to validate.' });
        }
        if (quantity < 1) {
            return res.status(400).json({ error: 'Please select a valid quantity.' });
        }

        const supabase = require('../config/supabase');

        let availableStock = 0;
        let productTitle = 'Product';
        let variantLabel = null;
        let image = null;

        if (variantId) {
            // Check variant stock
            const { data: variant } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label, variant_image_url')
                .eq('id', variantId)
                .single();

            availableStock = variant?.stock_quantity || 0;
            variantLabel = variant?.size_label;

            // Get product title
            const { data: product } = await supabase
                .from('products')
                .select('title, images')
                .eq('id', productId)
                .single();
            productTitle = product?.title || 'Product';
            image = variant?.variant_image_url || product?.images?.[0];
        } else {
            // Check product inventory
            const { data: product } = await supabase
                .from('products')
                .select('title, inventory, images')
                .eq('id', productId)
                .single();

            availableStock = product?.inventory || 0;
            productTitle = product?.title || 'Product';
            image = product?.images?.[0];
        }

        if (quantity > availableStock) {
            return res.json({
                valid: false,
                items: [{
                    productId,
                    variantId,
                    title: productTitle,
                    variantLabel,
                    requestedQty: quantity,
                    availableStock,
                    image
                }]
            });
        }

        res.json({ valid: true, items: [] });
    } catch (error) {
        logger.error({ err: error }, 'Error validating buy now stock:');
        res.status(500).json({ error: 'Unable to check stock availability. Please try again.' });
    }
});

// Create payment order for Buy Now (single item)
// NOW INCLUDES INLINE STOCK VALIDATION (Phase 2 Optimization)
router.post('/buy-now/create-payment-order', requestLock('create-payment-order'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { productId, variantId, quantity = 1 } = req.body;

        // Validation
        if (!productId) {
            return res.status(400).json({ error: 'Please select a product to purchase.' });
        }
        if (quantity < 1 || quantity > 100) {
            return res.status(400).json({ error: 'Please select a valid quantity (1-100).' });
        }

        const supabase = require('../config/supabase');

        // PHASE 2 OPTIMIZATION: Inline stock validation (eliminates separate API call)
        let availableStock = 0;
        let productTitle = 'Product';
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

            // Get product title for error message
            const { data: product } = await supabase
                .from('products')
                .select('title')
                .eq('id', productId)
                .single();
            productTitle = product?.title || 'Product';
        } else {
            // Check product inventory
            const { data: product } = await supabase
                .from('products')
                .select('title, inventory')
                .eq('id', productId)
                .single();

            availableStock = product?.inventory || 0;
            productTitle = product?.title || 'Product';
        }

        // Return user-friendly error if stock insufficient
        if (quantity > availableStock) {
            const itemDesc = variantLabel ? `${productTitle} (${variantLabel})` : productTitle;
            return res.status(400).json({
                error: `Sorry, ${itemDesc} is ${availableStock === 0 ? 'out of stock' : `low on stock (only ${availableStock} available)`}. Please adjust your quantity.`,
                stockIssue: {
                    productId,
                    variantId,
                    requestedQty: quantity,
                    availableStock
                }
            });
        }

        const { getBuyNowSummary, createRazorpayInvoice, createPaymentRecord } = require('../services/checkout.service');
        const summary = await getBuyNowSummary(userId, { productId, variantId, quantity });
        const amount = summary.totals.finalAmount;

        // Get User Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!profile) {
            return res.status(404).json({ error: 'Please complete your profile to continue with the purchase.' });
        }

        // Receipt ID
        const receipt = `buynow_${Date.now()}_${userId.substring(0, 8)}`;

        // Build line items for Razorpay Invoice
        const lineItems = summary.cart.cart_items.map((item, index) => {
            const variant = item.product_variants;
            const product = item.products;

            let razorpayItem = {
                item_id: variant?.razorpay_item_id || null,
                name: `${product.title}${variant ? ` - ${variant.size_label}` : ''}`,
                amount: Math.round((variant?.selling_price || product.price) * 100),
                currency: 'INR',
                quantity: item.quantity
            };

            // Attach delivery metadata to the first item
            if (index === 0) {
                razorpayItem.deliveryCharge = summary.totals.deliveryCharge || 0;
                razorpayItem.deliveryGST = summary.totals.deliveryGST || 0;
                razorpayItem.deliveryGSTRate = 18;
            }

            return razorpayItem;
        });

        // Create Razorpay Invoice
        const razorpayResponse = await createRazorpayInvoice(amount, receipt, profile, lineItems, summary.totals);

        // Create Payment Record
        const payment = await createPaymentRecord({
            user_id: userId,
            razorpay_order_id: razorpayResponse.id,
            invoice_id: razorpayResponse.invoice_id,
            amount,
            currency: 'INR',
            status: 'created'
        });

        res.json({
            order_id: razorpayResponse.id,
            amount: razorpayResponse.amount,
            currency: razorpayResponse.currency,
            payment_id: payment.id,
            key_id: process.env.RAZORPAY_KEY_ID,
            isBuyNow: true,
            buyNowData: {
                productId,
                variantId,
                quantity
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Error creating buy now payment order:');
        res.status(error.status || 500).json({ error: error.message || 'Unable to initiate payment. Please try again.' });
    }
});

// Verify payment and complete Buy Now order
router.post('/buy-now/verify-payment', requestLock('verify-payment'), idempotency(), async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { buyNowData, ...paymentData } = req.body;

        if (!buyNowData || !buyNowData.productId) {
            return res.status(400).json({ error: 'Invalid checkout session. Please try again from the product page.' });
        }

        const { processBuyNowOrder } = require('../services/checkout.service');
        const result = await processBuyNowOrder(userId, paymentData, buyNowData);

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error processing Buy Now payment:');

        // Return user-friendly error messages based on error type
        let userMessage = 'Unable to complete your order. ';
        if (error.message?.includes('Invalid payment signature')) {
            userMessage = 'Payment verification failed. Please contact support if money was deducted.';
        } else if (error.message?.includes('refunded')) {
            userMessage = error.message; // Keep refund messages as-is
        } else if (error.message?.includes('Insufficient stock')) {
            userMessage = 'Sorry, this item is now out of stock. Your payment has been refunded.';
        } else if (error.message?.includes('not found')) {
            userMessage += 'The product or address could not be found.';
        } else {
            userMessage += 'Please try again or contact support.';
        }

        res.status(error.status || 500).json({ error: userMessage });
    }
});

module.exports = router;

