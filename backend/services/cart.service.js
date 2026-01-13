const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { validateCoupon, calculateCouponDiscount } = require('./coupon.service');
const settingsService = require('./settings.service');

/**
 * Cart Service
 * Handles all shopping cart operations including adding/removing items, coupon application, and total calculations
 */

/**
 * Get or create a cart for the user
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Cart object with items
 */
async function getUserCart(userId) {
    try {
        // Atomic "Get or Create" using upsert (user_id is UNIQUE)
        const { data: cart, error } = await supabase
            .from('carts')
            .upsert([{ user_id: userId }], { onConflict: 'user_id' })
            .select(`
                *,
                cart_items (
                    id,
                    product_id,
                    quantity,
                    added_at,
                    products (*)
                )
            `)
            .single();

        if (error) throw error;

        // Ensure cart_items is an array
        if (!cart.cart_items) {
            cart.cart_items = [];
        }

        // Sort items locally if needed (upsert result might not be sorted)
        cart.cart_items.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));

        return cart;
    } catch (error) {
        logger.error({ err: error }, 'Error getting user cart:');
        throw error;
    }
}

/**
 * Add an item to the cart or update quantity if it already exists
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to add
 * @returns {Promise<object>} - Updated cart
 */
async function addToCart(userId, productId, quantity = 1) {
    try {
        const { data: cart, error } = await supabase.rpc('add_to_cart_atomic', {
            p_user_id: userId,
            p_product_id: productId,
            p_quantity: quantity
        });

        if (error) throw error;

        // Ensure cart_items is an array and sorted (matching getUserCart behavior)
        if (!cart.cart_items) cart.cart_items = [];
        cart.cart_items.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));

        return cart;
    } catch (error) {
        logger.error({ err: error }, 'Error adding to cart:');
        throw error;
    }
}

/**
 * Update cart item quantity
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {number} quantity - New quantity
 * @returns {Promise<object>} - Updated cart
 */
async function updateCartItem(userId, productId, quantity) {
    try {
        const { data: cart, error } = await supabase.rpc('update_cart_item_atomic', {
            p_user_id: userId,
            p_product_id: productId,
            p_quantity: quantity
        });

        if (error) throw error;

        // Ensure cart_items is an array and sorted
        if (!cart.cart_items) cart.cart_items = [];
        cart.cart_items.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));

        return cart;
    } catch (error) {
        logger.error({ err: error }, 'Error updating cart item:');
        throw error;
    }
}

/**
 * Remove an item from the cart
 * @param {string} userId - User ID
 * @param {string} productId - Product ID to remove
 * @returns {Promise<object>} - Updated cart
 */
async function removeFromCart(userId, productId) {
    try {
        const cart = await getUserCart(userId);

        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id)
            .eq('product_id', productId);

        if (error) throw error;

        return await getUserCart(userId);
    } catch (error) {
        logger.error({ err: error }, 'Error removing from cart:');
        throw error;
    }
}

/**
 * Apply a coupon to the cart
 * @param {string} userId - User ID
 * @param {string} couponCode - Coupon code
 * @returns {Promise<object>} - Validation result and updated cart
 */
async function applyCouponToCart(userId, couponCode) {
    try {
        const cart = await getUserCart(userId);

        // Prepare cart items for validation
        const cartItems = cart.cart_items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            product: item.products
        }));

        // Calculate cart total
        const cartTotal = cartItems.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
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

        const updatedCart = await getUserCart(userId);

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
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Updated cart
 */
async function removeCouponFromCart(userId) {
    try {
        const cart = await getUserCart(userId);

        const { error } = await supabase
            .from('carts')
            .update({ applied_coupon_code: null })
            .eq('id', cart.id);

        if (error) throw error;

        return await getUserCart(userId);
    } catch (error) {
        logger.error({ err: error }, 'Error removing coupon from cart:');
        throw error;
    }
}

/**
 * Calculate all cart totals including discounts and delivery
 * @param {string} userId - User ID
 * @param {object} [existingCart] - Optional pre-fetched cart to avoid redundant query
 * @returns {Promise<object>} - Cart totals breakdown
 */
async function calculateCartTotals(userId, existingCart = null) {
    try {
        // PERFORMANCE: Use existing cart if provided, avoiding redundant database fetch
        const cart = existingCart || await getUserCart(userId);

        const cartItems = cart.cart_items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            product: item.products
        }));

        // Calculate MRP and price totals
        let totalMrp = 0;
        let totalPrice = 0;

        cartItems.forEach(item => {
            const mrp = item.product.mrp || item.product.price;
            totalMrp += mrp * item.quantity;
            totalPrice += item.product.price * item.quantity;
        });

        const discount = totalMrp - totalPrice;

        // Calculate coupon discount
        let couponDiscount = 0;
        let coupon = null;

        if (cart.applied_coupon_code) {
            const validation = await validateCoupon(cart.applied_coupon_code, userId, cartItems, totalPrice);

            if (validation.valid) {
                coupon = validation.coupon;
                couponDiscount = calculateCouponDiscount(validation.coupon, cartItems, totalPrice);
            }
        }

        // Calculate delivery charge
        const settings = await settingsService.getDeliverySettings();
        const deliveryCharge = totalPrice >= settings.delivery_threshold ? 0 : settings.delivery_charge;

        // Calculate final amount
        const finalAmount = (totalPrice - couponDiscount) + deliveryCharge;

        return {
            itemsCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
            totalMrp: Math.round(totalMrp * 100) / 100,
            totalPrice: Math.round(totalPrice * 100) / 100,
            discount: Math.round(discount * 100) / 100,
            couponDiscount: Math.round(couponDiscount * 100) / 100,
            deliveryCharge: Math.round(deliveryCharge * 100) / 100,
            finalAmount: Math.round(finalAmount * 100) / 100,
            coupon
        };
    } catch (error) {
        logger.error({ err: error }, 'Error calculating cart totals:');
        throw error;
    }
}

/**
 * Clear all items from the cart (typically after order is placed)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function clearCart(userId) {
    try {
        const cart = await getUserCart(userId);

        // Delete all cart items
        const { error: deleteError } = await supabase
            .from('cart_items')
            .delete()
            .eq('cart_id', cart.id);

        if (deleteError) throw deleteError;

        // Remove applied coupon
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

module.exports = {
    getUserCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    applyCouponToCart,
    removeCouponFromCart,
    calculateCartTotals,
    clearCart
};
