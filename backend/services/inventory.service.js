const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Inventory Service
 * Handles stock management for products
 */

/**
 * Check if all items have sufficient stock
 * @param {Array} items - Array of { product_id, quantity } or cart items with product.id
 * @returns {Promise<{ available: boolean, insufficientItems: Array }>}
 */
const checkStockAvailability = async (items) => {
    const insufficientItems = [];

    for (const item of items) {
        const productId = item.product_id || item.product?.id;
        const quantity = item.quantity || 1;

        if (!productId) continue;

        const { data: product, error } = await supabase
            .from('products')
            .select('id, title, inventory')
            .eq('id', productId)
            .single();

        if (error || !product) {
            insufficientItems.push({
                product_id: productId,
                requested: quantity,
                available: 0,
                message: 'Product not found'
            });
            continue;
        }

        if (product.inventory < quantity) {
            insufficientItems.push({
                product_id: productId,
                title: product.title,
                requested: quantity,
                available: product.inventory,
                message: `Only ${product.inventory} units available`
            });
        }
    }

    return {
        available: insufficientItems.length === 0,
        insufficientItems
    };
};

/**
 * Decrease inventory for ordered items
 * @param {Array} items - Array of { product_id, quantity } or cart items
 * @returns {Promise<boolean>}
 */
const decreaseInventory = async (items) => {
    logger.info('[Inventory] Decreasing stock for', items.length, 'item(s)');

    for (const item of items) {
        const productId = item.product_id || item.product?.id;
        const quantity = item.quantity || 1;

        if (!productId) {
            logger.warn('[Inventory] Skipping item without product_id:');
            continue;
        }

        // Use RPC or raw SQL for atomic decrement (Supabase doesn't have native decrement)
        // Alternative: Fetch current value, calculate new, update
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('inventory')
            .eq('id', productId)
            .single();

        if (fetchError || !product) {
            logger.error({ err: productId, fetchError }, '[Inventory] Failed to fetch product:');
            continue;
        }

        const newInventory = Math.max(0, product.inventory - quantity);

        const { error: updateError } = await supabase
            .from('products')
            .update({ inventory: newInventory })
            .eq('id', productId);

        if (updateError) {
            logger.error({ err: productId, updateError }, '[Inventory] Failed to update product:');
        } else {
            logger.info(`[Inventory] Product ${productId}: ${product.inventory} -> ${newInventory}`);
        }
    }

    return true;
};

/**
 * Restore inventory for cancelled/returned items
 * @param {Array} items - Array of { product_id, quantity } or order items
 * @returns {Promise<boolean>}
 */
const restoreInventory = async (items) => {
    logger.info('[Inventory] Restoring stock for', items.length, 'item(s)');

    for (const item of items) {
        const productId = item.product_id || item.product?.id;
        const quantity = item.quantity || 1;

        if (!productId) {
            logger.warn('[Inventory] Skipping item without product_id:');
            continue;
        }

        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('inventory')
            .eq('id', productId)
            .single();

        if (fetchError || !product) {
            logger.error({ err: productId, fetchError }, '[Inventory] Failed to fetch product:');
            continue;
        }

        const newInventory = product.inventory + quantity;

        const { error: updateError } = await supabase
            .from('products')
            .update({ inventory: newInventory })
            .eq('id', productId);

        if (updateError) {
            logger.error({ err: productId, updateError }, '[Inventory] Failed to restore product:');
        } else {
            logger.info(`[Inventory] Product ${productId}: ${product.inventory} -> ${newInventory} (restored)`);
        }
    }

    return true;
};

module.exports = {
    checkStockAvailability,
    decreaseInventory,
    restoreInventory
};
