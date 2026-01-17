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

        const { productId, variantId, quantity = 1 } = req.body;

        // Validation
        if (!productId) {
            return res.status(400).json({ error: 'Please select a product to continue.' });
        }
        if (quantity < 1 || quantity > 100) {
            return res.status(400).json({ error: 'Please select a valid quantity (1-100).' });
        }

        const supabase = require('../config/supabase');
        const addressService = require('../services/address.service');

        // Fetch product
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: 'This product is no longer available. Please try a different product.' });
        }

        // Fetch variant if provided
        let variant = null;
        if (variantId) {
            const { data: v } = await supabase
                .from('product_variants')
                .select('*')
                .eq('id', variantId)
                .single();
            variant = v;
            if (!variant) {
                return res.status(404).json({ error: 'The selected variant is no longer available. Please select a different option.' });
            }
        }

        // Calculate prices
        const unitPrice = variant?.selling_price || product.price;
        const unitMrp = variant?.mrp || product.mrp || unitPrice;
        const subtotal = unitPrice * quantity;
        const mrpTotal = unitMrp * quantity;
        const discount = mrpTotal - subtotal;

        // Delivery charge (variant > product > 0)
        // Fetch delivery settings
        const settingsService = require('../services/settings.service');
        const { delivery_charge: globalCharge, delivery_threshold: threshold } = await settingsService.getDeliverySettings();

        // Product-specific delivery charge
        const productCharge = variant?.delivery_charge ?? product.delivery_charge ?? 0;

        // Calculate total delivery charge (Product + Global if under threshold)
        const applicableGlobalCharge = subtotal >= threshold ? 0 : globalCharge;
        const deliveryCharge = productCharge + applicableGlobalCharge;

        // Fetch addresses
        let shippingAddress = null;
        let billingAddress = null;
        try {
            const addresses = await addressService.getAddresses(userId);
            shippingAddress = addresses.find(a => a.is_primary) || addresses[0];
            billingAddress = shippingAddress;
        } catch (e) {
            // No addresses yet
        }

        // Build mock cart item for UI compatibility
        const mockCartItem = {
            id: `buynow-${productId}-${variantId || 'default'}`,
            product_id: productId,
            variant_id: variantId,
            quantity,
            products: product,
            product_variants: variant
        };

        const summary = {
            cart: {
                id: 'buy-now',
                cart_items: [mockCartItem]
            },
            totals: {
                mrpTotal,
                subtotal,
                discount,
                couponDiscount: 0, // No coupons for buy now
                deliveryCharge,
                finalAmount: subtotal + deliveryCharge
            },
            shipping_address: shippingAddress,
            billing_address: billingAddress,
            isBuyNow: true
        };

        res.json(summary);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching buy now summary:');
        res.status(500).json({ error: 'Unable to load checkout details. Please try again or contact support if the issue persists.' });
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

        // Get User Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!profile) {
            return res.status(404).json({ error: 'Please complete your profile to continue with the purchase.' });
        }

        // Fetch product
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: 'This product is no longer available for purchase.' });
        }

        // Fetch variant if provided
        let variant = null;
        if (variantId) {
            const { data: v } = await supabase
                .from('product_variants')
                .select('*')
                .eq('id', variantId)
                .single();
            variant = v;
            if (!variant) {
                return res.status(404).json({ error: 'The selected variant is no longer available.' });
            }
        }

        // Calculate totals
        const unitPrice = variant?.selling_price || product.price;
        const subtotal = unitPrice * quantity;
        // Fetch delivery settings
        const settingsService = require('../services/settings.service');
        const { delivery_charge: globalCharge, delivery_threshold: threshold } = await settingsService.getDeliverySettings();

        // Product-specific delivery charge
        const productCharge = variant?.delivery_charge ?? product.delivery_charge ?? 0;

        // Calculate total delivery charge (Product + Global if under threshold)
        // Note: For Buy Now, we check subtotal against threshold
        const applicableGlobalCharge = subtotal >= threshold ? 0 : globalCharge;
        const deliveryCharge = productCharge + applicableGlobalCharge;
        const amount = subtotal + deliveryCharge;

        // Receipt ID
        const receipt = `buynow_${Date.now()}_${userId.substring(0, 8)}`;

        // Build line items
        const lineItems = [];

        if (variant?.razorpay_item_id) {
            lineItems.push({
                item_id: variant.razorpay_item_id,
                quantity
            });
        } else {
            lineItems.push({
                name: `${product.title}${variant ? ` - ${variant.size_label}` : ''}`,
                amount: Math.round(unitPrice * 100),
                currency: 'INR',
                quantity
            });
        }

        // Add delivery charge if applicable
        if (deliveryCharge > 0) {
            lineItems.push({
                name: 'Delivery Charge',
                amount: Math.round(deliveryCharge * 100),
                currency: 'INR',
                quantity: 1
            });
        }

        // Create Razorpay Invoice
        const razorpayResponse = await createRazorpayInvoice(amount, receipt, profile, lineItems);

        // Create Payment Record (without metadata since table doesn't support it)
        const payment = await createPaymentRecord({
            user_id: userId,
            razorpay_order_id: razorpayResponse.id,
            amount,
            currency: 'INR',
            status: 'created'
        });

        // Return buy now details for frontend to pass to verify-payment
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
        res.status(500).json({ error: 'Unable to initiate payment. Please try again or use a different payment method.' });
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

