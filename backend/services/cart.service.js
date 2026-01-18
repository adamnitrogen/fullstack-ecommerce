const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { validateCoupon, calculateCouponDiscount } = require('./coupon.service');
const settingsService = require('./settings.service');


/**
 * Get delivery settings (hits DB via SettingsService)
 */
async function getCachedDeliverySettings() {
    return await settingsService.getDeliverySettings();
}

function invalidateDeliverySettingsCache() {
    // No-op as we removed in-memory cache for production robustness
}

/**
 * Get or create a cart for the user
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Cart object with items
 */


/**
 * Cart Service
 * Handles all shopping cart operations including adding/removing items, coupon application, and total calculations
 */

/**
 * Get or create a cart for the user or guest
 * @param {string|null} userId - User ID (optional if guestId provided)
 * @param {string|null} guestId - Guest ID (optional if userId provided)
 * @returns {Promise<object>} - Cart object with items
 */
async function getUserCart(userId, guestId) {
    try {
        if (!userId && !guestId) throw new Error('UserId or GuestId required');

        let query = supabase.from('carts').select(`
            *,
            cart_items (
                id,
                product_id,
                variant_id,
                quantity,
                added_at,
                products (*),
                product_variants (*)
            )
        `);

        if (userId) {
            query = query.eq('user_id', userId);
        } else {
            query = query.eq('guest_id', guestId).is('user_id', null);
        }

        let { data: cart, error } = await query.single();

        // If cart not found, create one
        if (!cart && !error) {
            // Logic to create cart
            const newCartData = userId ? { user_id: userId } : { guest_id: guestId };
            const { data: newCart, error: createError } = await supabase
                .from('carts')
                .insert(newCartData)
                .select()
                .single();

            if (createError) {
                // Handle concurrent creation (race condition)
                if (createError.code === '23505') { // Unique violation
                    // Retry fetch
                    return getUserCart(userId, guestId);
                }
                throw createError;
            }
            cart = newCart;
            cart.cart_items = [];
        } else if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" (single() returns this if no rows)
            // Actually Supabase JS .single() returns error if no rows or multiple rows.
            // If error is null, cart exists. If error, check code.
            throw error;
        } else if (error && error.code === 'PGRST116') {
            // Not found, create
            const newCartData = userId ? { user_id: userId } : { guest_id: guestId };
            const { data: newCart, error: createError } = await supabase
                .from('carts')
                .insert(newCartData)
                .select()
                .single();

            if (createError) {
                if (createError.code === '23505') return getUserCart(userId, guestId);
                throw createError;
            }
            cart = newCart;
            cart.cart_items = [];
        }

        // Ensure cart_items is an array
        if (!cart.cart_items) {
            cart.cart_items = [];
        }

        // Sort items locally
        cart.cart_items.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));

        return cart;
    } catch (error) {
        logger.error({ err: error, userId, guestId }, 'Error getting cart:');
        throw error;
    }
}

/**
 * Add an item to the cart
 * @param {string|null} userId 
 * @param {string|null} guestId
 * @param {string} productId 
 * @param {number} quantity 
 * @param {string} [variantId]
 */
async function addToCart(userId, guestId, productId, quantity = 1, variantId = null) {
    try {
        const cart = await getUserCart(userId, guestId);

        // Stock validation - check available stock before adding
        let availableStock = 0;
        let productTitle = 'Product';

        if (variantId) {
            // Check variant stock
            const { data: variant, error: variantError } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label, products(title)')
                .eq('id', variantId)
                .single();

            if (variantError || !variant) {
                throw new Error('Variant not found');
            }
            availableStock = variant.stock_quantity || 0;
            productTitle = `${variant.products?.title || 'Product'} - ${variant.size_label}`;
        } else {
            // Check product inventory
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('inventory, title')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                throw new Error('Product not found');
            }
            availableStock = product.inventory || 0;
            productTitle = product.title;
        }

        // Check if item already exists in cart to calculate total quantity
        const existingItem = cart.cart_items.find(item =>
            item.product_id === productId &&
            (item.variant_id === variantId || (!item.variant_id && !variantId))
        );

        const currentCartQty = existingItem ? existingItem.quantity : 0;
        const requestedTotal = currentCartQty + quantity;

        if (requestedTotal > availableStock) {
            throw new Error(`Insufficient stock for ${productTitle}. Available: ${availableStock}, Requested: ${requestedTotal}`);
        }

        if (existingItem) {
            // Update quantity
            return updateCartItem(userId, guestId, productId, existingItem.quantity + quantity, variantId);
        }

        // Insert new item
        const { error } = await supabase
            .from('cart_items')
            .insert({
                cart_id: cart.id,
                product_id: productId,
                quantity: quantity,
                variant_id: variantId
            });

        if (error) throw error;

        return getUserCart(userId, guestId);
    } catch (error) {
        logger.error({ err: error }, 'Error adding to cart:');
        throw error;
    }
}

/**
 * Update cart item quantity
 */
async function updateCartItem(userId, guestId, productId, quantity, variantId = null) {
    try {
        const cart = await getUserCart(userId, guestId);

        if (quantity <= 0) {
            return removeFromCart(userId, guestId, productId, variantId);
        }

        // Stock validation - check available stock before updating
        let availableStock = 0;
        let productTitle = 'Product';

        if (variantId) {
            // Check variant stock
            const { data: variant, error: variantError } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label, products(title)')
                .eq('id', variantId)
                .single();

            if (variantError || !variant) {
                throw new Error('Variant not found');
            }
            availableStock = variant.stock_quantity || 0;
            productTitle = `${variant.products?.title || 'Product'} - ${variant.size_label}`;
        } else {
            // Check product inventory
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('inventory, title')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                throw new Error('Product not found');
            }
            availableStock = product.inventory || 0;
            productTitle = product.title;
        }

        if (quantity > availableStock) {
            throw new Error(`Insufficient stock for ${productTitle}. Available: ${availableStock}, Requested: ${quantity}`);
        }

        // Find match to get ID (safe update) or update by composite key if permitted
        // We'll update by cart_id + product_id + variant_id
        let query = supabase
            .from('cart_items')
            .update({ quantity })
            .eq('cart_id', cart.id)
            .eq('product_id', productId);

        if (variantId) {
            query = query.eq('variant_id', variantId);
        } else {
            query = query.is('variant_id', null);
        }

        const { error } = await query;

        if (error) throw error;

        return getUserCart(userId, guestId);
    } catch (error) {
        logger.error({ err: error }, 'Error updating cart item:');
        throw error;
    }
}

/**
 * Remove an item from the cart
 */
async function removeFromCart(userId, guestId, productId, variantId = null) {
    try {
        const cart = await getUserCart(userId, guestId);

        let query = supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id)
            .eq('product_id', productId);

        if (variantId) {
            query = query.eq('variant_id', variantId);
        } else {
            query = query.is('variant_id', null);
        }

        const { error } = await query;
        if (error) throw error;

        return getUserCart(userId, guestId);
    } catch (error) {
        logger.error({ err: error }, 'Error removing from cart:');
        throw error;
    }
}

/**
 * Apply a coupon to the cart
 */
async function applyCouponToCart(userId, guestId, couponCode) {
    try {
        const cart = await getUserCart(userId, guestId);

        // Prepare cart items for validation
        const cartItems = cart.cart_items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            variant_id: item.variant_id,
            product: item.products,
            variant: item.product_variants
        }));

        // Calculate cart total (considering variants)
        const cartTotal = cartItems.reduce((sum, item) => {
            const price = item.variant ? item.variant.selling_price : item.product.price;
            return sum + (price * item.quantity);
        }, 0);

        // Validate coupon
        const validation = await validateCoupon(couponCode, userId, cartItems, cartTotal);

        if (!validation.valid) {
            return { success: false, error: validation.error, cart };
        }

        // Update cart with coupon code
        const { error } = await supabase
            .from('carts')
            .update({ applied_coupon_code: couponCode.toUpperCase() })
            .eq('id', cart.id);

        if (error) throw error;

        const updatedCart = await getUserCart(userId, guestId);

        return {
            success: true,
            cart: updatedCart,
            coupon: validation.coupon,
            message: 'Coupon applied successfully'
        };
    } catch (error) {
        logger.error({ err: error }, 'Error applying coupon to cart:');
        throw error;
    }
}

/**
 * Remove coupon from cart
 */
async function removeCouponFromCart(userId, guestId) {
    try {
        const cart = await getUserCart(userId, guestId);

        const { error } = await supabase
            .from('carts')
            .update({ applied_coupon_code: null })
            .eq('id', cart.id);

        if (error) throw error;

        return await getUserCart(userId, guestId);
    } catch (error) {
        logger.error({ err: error }, 'Error removing coupon from cart:');
        throw error;
    }
}

/**
 * Calculate all cart totals including discounts and delivery
 * @param {string|null} userId
 * @param {string|null} guestId
 * @param {object|null} existingCart - Optional pre-fetched cart
 * @param {object} options - Optimization options
 * @param {boolean} options.skipValidation - If true, skip full coupon validation (use for quantity updates)
 */
async function calculateCartTotals(userId, guestId, existingCart = null, { skipValidation = false } = {}) {
    try {
        const cart = existingCart || await getUserCart(userId, guestId);

        const cartItems = cart.cart_items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            variant_id: item.variant_id,
            product: item.products,
            variant: item.product_variants
        }));

        // Calculate MRP, price totals, and product-specific delivery charges
        let totalMrp = 0;
        let totalPrice = 0;
        let productDeliveryCharge = 0;
        const itemLevelBreakdown = [];
        const seenProductIds = new Set();

        cartItems.forEach(item => {
            const price = item.variant ? item.variant.selling_price : item.product.price;
            const mrp = item.variant ? item.variant.mrp : (item.product.mrp || item.product.price);

            // Accumulate totals
            totalPrice += price * item.quantity;
            totalMrp += mrp * item.quantity;

            itemLevelBreakdown.push({
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity,
                mrp: mrp,
                price: price,
                delivery_charge: 0, // Will be updated below
                coupon_discount: 0,
                coupon_code: null
            });
        });

        const autoDiscount = totalMrp - totalPrice;

        // Calculate coupon discount
        let couponDiscount = 0;
        let coupon = null;
        let itemDiscountsBreakdown = [];

        if (cart.applied_coupon_code) {
            if (skipValidation) {
                // OPTIMIZATION: Skip full validation, just fetch coupon and recalculate discount
                // Use the coupon cache from coupon.service.js (already has 60s TTL)
                const { getCachedCoupon } = require('./coupon.service');
                coupon = await getCachedCoupon(cart.applied_coupon_code);

                if (coupon && coupon.is_active) {
                    const result = calculateCouponDiscount(coupon, cartItems, totalPrice);
                    couponDiscount = result.totalDiscount;
                    itemDiscountsBreakdown = result.itemDiscounts;
                }
            } else {
                // Full validation (includes expiry, usage limits, target checks)
                const validation = await validateCoupon(cart.applied_coupon_code, userId, cartItems, totalPrice);

                if (validation.valid) {
                    coupon = validation.coupon;
                    const result = calculateCouponDiscount(validation.coupon, cartItems, totalPrice);
                    couponDiscount = result.totalDiscount;
                    itemDiscountsBreakdown = result.itemDiscounts;
                }
            }

            // Update itemLevelBreakdown with coupon discounts
            itemDiscountsBreakdown.forEach(disc => {
                const item = itemLevelBreakdown.find(i =>
                    (disc.variant_id ? (i.variant_id === disc.variant_id) : (i.product_id === disc.product_id))
                );
                if (item) {
                    item.coupon_discount += disc.discount;
                    item.coupon_code = disc.coupon_code;
                }
            });
        }

        // NEW DYNAMIC DELIVERY LOGIC
        // Calculate delivery charges using DeliveryChargeService
        const { DeliveryChargeService } = require('./delivery-charge.service');

        let totalDeliveryCharge = 0;
        let totalDeliveryGST = 0;
        let deliveryResult;

        try {
            deliveryResult = await DeliveryChargeService.calculateCartDelivery(cartItems, totalPrice);
            totalDeliveryCharge = deliveryResult.totalDeliveryCharge;
            totalDeliveryGST = deliveryResult.totalDeliveryGST;

            // Map delivery charges back to items for breakdown
            if (deliveryResult.items) {
                deliveryResult.items.forEach(delItem => {
                    const item = itemLevelBreakdown.find(i =>
                        (delItem.variant_id ? (i.variant_id === delItem.variant_id) : (i.product_id === delItem.product_id))
                    );
                    if (item) {
                        item.delivery_charge = delItem.deliveryCharge;
                        item.delivery_gst = delItem.deliveryGST;
                        item.delivery_meta = delItem.snapshot;
                    }
                });
            }
        } catch (error) {
            totalDeliveryGST = 0;
        }

        // Separate Global vs Product Delivery Charges
        let globalDeliveryCharge = 0;
        let productDeliveryCharges = 0;
        let globalDeliveryGST = 0;
        let productDeliveryGST = 0;

        if (itemLevelBreakdown.length > 0) {
            // Better: Iterate deliveryResult.items directly if available
            if (typeof deliveryResult !== 'undefined' && deliveryResult.items) {
                deliveryResult.items.forEach(delItem => {
                    const isGlobal = delItem.snapshot?.source === 'global';
                    if (isGlobal) {
                        // Standard / Global Delivery
                        globalDeliveryCharge += delItem.deliveryCharge;
                        globalDeliveryGST += delItem.deliveryGST;
                    } else {
                        // Product Specific (Surcharges)
                        productDeliveryCharges += delItem.deliveryCharge;
                        productDeliveryGST += delItem.deliveryGST;
                    }
                });
            }
        }

        // Calculate final amount (including delivery GST)
        const finalAmount = (totalPrice - couponDiscount) + totalDeliveryCharge + totalDeliveryGST;

        // Get current delivery settings for frontend synchronization
        const settings = await getCachedDeliverySettings();

        return {
            itemsCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
            totalMrp: Math.round(totalMrp * 100) / 100,
            totalPrice: Math.round(totalPrice * 100) / 100,
            discount: Math.round(autoDiscount * 100) / 100,
            couponDiscount: Math.round(couponDiscount * 100) / 100,
            deliveryCharge: Math.round(totalDeliveryCharge * 100) / 100,
            deliveryGST: Math.round(totalDeliveryGST * 100) / 100,
            globalDeliveryCharge: Math.round(globalDeliveryCharge * 100) / 100,
            productDeliveryCharges: Math.round(productDeliveryCharges * 100) / 100,
            globalDeliveryGST: Math.round(globalDeliveryGST * 100) / 100,
            productDeliveryGST: Math.round(productDeliveryGST * 100) / 100,
            finalAmount: Math.round(finalAmount * 100) / 100,
            coupon,
            itemBreakdown: itemLevelBreakdown,
            deliverySettings: {
                threshold: settings.delivery_threshold,
                charge: settings.delivery_charge,
                gst: settings.delivery_gst
            }
        };
    } catch (error) {
        logger.error({ err: error }, 'Error calculating cart totals:');
        throw error;
    }
}

/**
 * Clear all items from the cart
 */
async function clearCart(userId, guestId) {
    try {
        const cart = await getUserCart(userId, guestId);

        const { error: deleteError } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id);

        if (deleteError) throw deleteError;

        const { error: updateError } = await supabase
            .from('carts')
            .update({ applied_coupon_code: null })
            .eq('id', cart.id);

        if (updateError) throw updateError;
    } catch (error) {
        logger.error({ err: error }, 'Error clearing cart:');
        throw error;
    }
}

/**
 * Merge guest cart into user cart
 * @param {string} userId
 * @param {string} guestId
 */
async function mergeGuestCart(userId, guestId) {
    if (!userId || !guestId) return;

    try {
        // 1. Get Guest Cart
        const guestCart = await getUserCart(null, guestId);
        if (!guestCart || guestCart.cart_items.length === 0) return;

        // 2. Get (or create) User Cart
        const userCart = await getUserCart(userId, null);

        // 3. Merge Items
        for (const item of guestCart.cart_items) {
            // Check for existing item in user cart
            const existingItem = userCart.cart_items.find(ui =>
                ui.product_id === item.product_id &&
                (ui.variant_id === item.variant_id || (!ui.variant_id && !item.variant_id))
            );

            if (existingItem) {
                // Update quantity (add guest quantity to user quantity)
                await updateCartItem(userId, null, item.product_id, existingItem.quantity + item.quantity, item.variant_id);
            } else {
                // Add new item
                await addToCart(userId, null, item.product_id, item.quantity, item.variant_id);
            }
        }

        // 4. Merge Coupon (if user has none but guest does)
        if (guestCart.applied_coupon_code && !userCart.applied_coupon_code) {
            await supabase
                .from('carts')
                .update({ applied_coupon_code: guestCart.applied_coupon_code })
                .eq('id', userCart.id);
        }

        // 5. Delete Guest Cart Items & Cart
        await clearCart(null, guestId);
        await supabase.from('carts').delete().eq('id', guestCart.id);

        logger.info({ userId, guestId }, 'Guest cart merged successfully');
        return getUserCart(userId, null);
    } catch (error) {
        logger.error({ err: error, userId, guestId }, 'Error merging guest cart:');
        // Don't throw, just log. Merging failure shouldn't block login.
    }
}

module.exports = {
    getUserCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    applyCouponToCart,
    removeCouponFromCart,
    calculateCartTotals,
    clearCart,
    mergeGuestCart,
    invalidateDeliverySettingsCache
};
