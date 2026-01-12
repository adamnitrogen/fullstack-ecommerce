const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Coupon Service
 * Handles all coupon-related business logic including validation, discount calculation, and usage tracking
 */

const DELIVERY_THRESHOLD = 1500;
const DELIVERY_CHARGE = 50;

/**
 * Validate if a coupon can be applied to the given cart
 * @param {string} code - Coupon code
 * @param {string} userId - User ID
 * @param {Array} cartItems - Array of cart items with product details
 * @param {number} cartTotal - Total cart value before discount
 * @returns {Promise<{valid: boolean, coupon?: object, error?: string}>}
 */
async function validateCoupon(code, userId, cartItems, cartTotal) {
    try {
        // Fetch coupon by code (case-insensitive)
        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', code.toUpperCase())
            .single();

        if (error || !coupon) {
            return { valid: false, error: 'Invalid coupon code' };
        }

        // Check if coupon is active
        if (!coupon.is_active) {
            return { valid: false, error: 'This coupon is no longer active' };
        }

        // Check expiry date
        const now = new Date();
        const validFrom = new Date(coupon.valid_from);
        const validUntil = new Date(coupon.valid_until);

        if (now < validFrom) {
            return { valid: false, error: 'This coupon is not yet valid' };
        }

        if (now > validUntil) {
            return { valid: false, error: 'This coupon has expired' };
        }

        // Check usage limit
        if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
            return { valid: false, error: 'This coupon has reached its usage limit' };
        }

        // Check minimum purchase amount
        if (coupon.min_purchase_amount && cartTotal < coupon.min_purchase_amount) {
            return { 
                valid: false, 
                error: `Minimum purchase amount of ₹${coupon.min_purchase_amount} required` 
            };
        }

        // Type-specific validation
        if (coupon.type === 'product') {
            // Check if the specific product is in the cart
            const hasProduct = cartItems.some(item => item.product_id === coupon.target_id);
            if (!hasProduct) {
                return { valid: false, error: 'This coupon is only valid for a specific product not in your cart' };
            }
        }

        if (coupon.type === 'category') {
            // Check if any product from the category is in the cart
            const hasCategory = cartItems.some(item => item.product && item.product.category === coupon.target_id);
            if (!hasCategory) {
                return { valid: false, error: `This coupon is only valid for products in category: ${coupon.target_id}` };
            }
        }

        return { valid: true, coupon };
    } catch (error) {
        logger.error({ err: error }, 'Error validating coupon:');
        return { valid: false, error: 'Error validating coupon' };
    }
}

/**
 * Calculate discount amount based on coupon type and cart items
 * @param {object} coupon - Coupon object
 * @param {Array} cartItems - Array of cart items with product details
 * @param {number} cartTotal - Total cart value
 * @returns {number} - Discount amount
 */
function calculateCouponDiscount(coupon, cartItems, cartTotal) {
    let applicableAmount = 0;

    if (coupon.type === 'cart') {
        // Apply to entire cart
        applicableAmount = cartTotal;
    } else if (coupon.type === 'product') {
        // Apply only to the specific product
        const targetItem = cartItems.find(item => item.product_id === coupon.target_id);
        if (targetItem && targetItem.product) {
            applicableAmount = targetItem.product.price * targetItem.quantity;
        }
    } else if (coupon.type === 'category') {
        // Apply to all products in the category
        applicableAmount = cartItems
            .filter(item => item.product && item.product.category === coupon.target_id)
            .reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }

    // Calculate percentage discount
    let discount = (applicableAmount * coupon.discount_percentage) / 100;

    // Apply max discount cap if specified
    if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimal places
}

/**
 * Increment the usage count for a coupon
 * @param {string} couponId - Coupon ID
 */
async function incrementUsageCount(couponId) {
    try {
        const { error } = await supabase
            .from('coupons')
            .update({ usage_count: supabase.raw('usage_count + 1') })
            .eq('id', couponId);

        if (error) {
            logger.error({ err: error }, 'Error incrementing coupon usage count:');
        }
    } catch (error) {
        logger.error({ err: error }, 'Error incrementing coupon usage count:');
    }
}

/**
 * Get all active, non-expired coupons for promotional banners
 * @returns {Promise<Array>} - Array of active coupons
 */
async function getActiveCoupons() {
    try {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('is_active', true)
            .lte('valid_from', now)
            .gte('valid_until', now)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter out coupons that have reached usage limit
        const availableCoupons = data.filter(coupon => {
            if (coupon.usage_limit === null) return true;
            return coupon.usage_count < coupon.usage_limit;
        });

        return availableCoupons;
    } catch (error) {
        logger.error({ err: error }, 'Error fetching active coupons:');
        return [];
    }
}

/**
 * Record coupon usage in the tracking table
 * @param {string} couponId - Coupon ID
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @param {number} discountApplied - Discount amount
 */
async function recordCouponUsage(couponId, userId, orderId, discountApplied) {
    try {
        const { error } = await supabase
            .from('coupon_usage')
            .insert([{
                coupon_id: couponId,
                user_id: userId,
                order_id: orderId,
                discount_applied: discountApplied
            }]);

        if (error) {
            logger.error({ err: error }, 'Error recording coupon usage:');
        }
    } catch (error) {
        logger.error({ err: error }, 'Error recording coupon usage:');
    }
}

module.exports = {
    validateCoupon,
    calculateCouponDiscount,
    incrementUsageCount,
    getActiveCoupons,
    recordCouponUsage,
    DELIVERY_THRESHOLD,
    DELIVERY_CHARGE
};
