const supabase = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');

// Create module-specific logger
const log = createModuleLogger('InventoryService');

/**
 * Inventory Service
 * Handles thread-safe stock management for products using atomic PostgreSQL operations
 */

/**
 * Check if all items have sufficient stock
 * @param {Array} items - Array of { product_id, quantity } or cart items with product.id
 * @returns {Promise<{ available: boolean, insufficientItems: Array }>}
 */
const checkStockAvailability = async (items) => {
    log.operationStart('CHECK_STOCK', { itemCount: items.length });
    const startTime = Date.now();
    const insufficientItems = [];

    for (const item of items) {
        const productId = item.product_id || item.product?.id;
        const quantity = item.quantity || 1;

        if (!productId) {
            log.warn('CHECK_STOCK', 'Skipping item without product_id', { item });
            continue;
        }

        const { data: product, error } = await supabase
            .from('products')
            .select('id, title, inventory')
            .eq('id', productId)
            .single();

        if (error || !product) {
            log.warn('CHECK_STOCK', 'Product not found', { productId, error: error?.message });
            insufficientItems.push({
                product_id: productId,
                requested: quantity,
                available: 0,
                message: 'Product not found'
            });
            continue;
        }

        if (product.inventory < quantity) {
            log.debug('CHECK_STOCK', 'Insufficient stock', {
                productId,
                title: product.title,
                requested: quantity,
                available: product.inventory
            });
            insufficientItems.push({
                product_id: productId,
                title: product.title,
                requested: quantity,
                available: product.inventory,
                message: `Only ${product.inventory} units available`
            });
        }
    }

    const result = {
        available: insufficientItems.length === 0,
        insufficientItems
    };

    if (result.available) {
        log.operationSuccess('CHECK_STOCK', { itemCount: items.length, allAvailable: true }, Date.now() - startTime);
    } else {
        log.warn('CHECK_STOCK', 'Some items have insufficient stock', {
            insufficientCount: insufficientItems.length,
            items: insufficientItems.map(i => ({ productId: i.product_id, requested: i.requested, available: i.available }))
        });
    }

    return result;
};

/**
 * Decrease inventory for ordered items using ATOMIC PostgreSQL function
 * This prevents race conditions when multiple users order the same product
 * 
 * @param {Array} items - Array of { product_id, quantity } or cart items
 * @returns {Promise<{ success: boolean, results: Array, error?: string }>}
 */
const decreaseInventory = async (items) => {
    const trace = getTraceContext();
    log.operationStart('DECREASE_INVENTORY', { itemCount: items.length });
    const startTime = Date.now();
    const results = [];
    let allSuccess = true;

    for (const item of items) {
        const productId = item.product_id || item.product?.id;
        const quantity = item.quantity || 1;

        if (!productId) {
            log.warn('DECREASE_INVENTORY', 'Skipping item without product_id');
            continue;
        }

        // Use atomic PostgreSQL function with row-level locking
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('decrement_inventory_atomic', {
                p_product_id: productId,
                p_quantity: quantity,
                p_trace_id: trace.traceId
            });

        if (rpcError) {
            log.operationError('DECREASE_INVENTORY', rpcError, { productId, quantity });
            allSuccess = false;
            results.push({
                productId,
                success: false,
                error: rpcError.message
            });
            continue;
        }

        if (!rpcResult?.success) {
            log.warn('DECREASE_INVENTORY', 'Atomic decrement failed', {
                productId,
                error: rpcResult?.error,
                message: rpcResult?.message,
                available: rpcResult?.available
            });
            allSuccess = false;
            results.push({
                productId,
                success: false,
                error: rpcResult?.error || 'DECREMENT_FAILED',
                message: rpcResult?.message,
                available: rpcResult?.available
            });
            continue;
        }

        log.debug('DECREASE_INVENTORY', 'Stock decremented', {
            productId,
            productTitle: rpcResult.productTitle,
            previous: rpcResult.previousInventory,
            new: rpcResult.newInventory,
            decremented: rpcResult.decremented
        });

        results.push({
            productId,
            success: true,
            previousInventory: rpcResult.previousInventory,
            newInventory: rpcResult.newInventory
        });
    }

    if (allSuccess) {
        log.operationSuccess('DECREASE_INVENTORY', { itemCount: items.length, results }, Date.now() - startTime);
    } else {
        log.warn('DECREASE_INVENTORY', 'Some items failed to decrement', {
            failedCount: results.filter(r => !r.success).length
        });
    }

    return { success: allSuccess, results };
};

/**
 * Restore inventory for cancelled/returned items using ATOMIC PostgreSQL function
 * 
 * @param {Array} items - Array of { product_id, quantity } or order items
 * @returns {Promise<{ success: boolean, results: Array }>}
 */
const restoreInventory = async (items) => {
    const trace = getTraceContext();
    log.operationStart('RESTORE_INVENTORY', { itemCount: items.length });
    const startTime = Date.now();
    const results = [];
    let allSuccess = true;

    for (const item of items) {
        const productId = item.product_id || item.product?.id;
        const quantity = item.quantity || 1;

        if (!productId) {
            log.warn('RESTORE_INVENTORY', 'Skipping item without product_id');
            continue;
        }

        // Use atomic PostgreSQL function
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('increment_inventory_atomic', {
                p_product_id: productId,
                p_quantity: quantity,
                p_trace_id: trace.traceId
            });

        if (rpcError) {
            log.operationError('RESTORE_INVENTORY', rpcError, { productId, quantity });
            allSuccess = false;
            results.push({
                productId,
                success: false,
                error: rpcError.message
            });
            continue;
        }

        if (!rpcResult?.success) {
            log.warn('RESTORE_INVENTORY', 'Atomic increment failed', {
                productId,
                error: rpcResult?.error,
                message: rpcResult?.message
            });
            allSuccess = false;
            results.push({
                productId,
                success: false,
                error: rpcResult?.error || 'INCREMENT_FAILED'
            });
            continue;
        }

        log.debug('RESTORE_INVENTORY', 'Stock restored', {
            productId,
            productTitle: rpcResult.productTitle,
            previous: rpcResult.previousInventory,
            new: rpcResult.newInventory,
            restored: rpcResult.incremented
        });

        results.push({
            productId,
            success: true,
            previousInventory: rpcResult.previousInventory,
            newInventory: rpcResult.newInventory
        });
    }

    if (allSuccess) {
        log.operationSuccess('RESTORE_INVENTORY', { itemCount: items.length }, Date.now() - startTime);
    } else {
        log.warn('RESTORE_INVENTORY', 'Some items failed to restore', {
            failedCount: results.filter(r => !r.success).length
        });
    }

    return { success: allSuccess, results };
};

/**
 * Batch decrease inventory atomically - all or nothing
 * Uses PostgreSQL function that rolls back all if any fails
 * 
 * @param {Array} items - Array of { product_id, quantity }
 * @returns {Promise<{ success: boolean, error?: string, failedItems?: Array }>}
 */
const batchDecreaseInventory = async (items) => {
    const trace = getTraceContext();
    log.operationStart('BATCH_DECREASE_INVENTORY', { itemCount: items.length });
    const startTime = Date.now();

    // Normalize items format
    const normalizedItems = items.map(item => ({
        product_id: item.product_id || item.product?.id,
        quantity: item.quantity || 1
    })).filter(item => item.product_id);

    const { data: rpcResult, error: rpcError } = await supabase
        .rpc('batch_decrement_inventory_atomic', {
            p_items: normalizedItems,
            p_trace_id: trace.traceId
        });

    if (rpcError) {
        log.operationError('BATCH_DECREASE_INVENTORY', rpcError, { itemCount: items.length });
        return { success: false, error: rpcError.message };
    }

    if (!rpcResult?.success) {
        log.warn('BATCH_DECREASE_INVENTORY', 'Batch failed - rolled back', {
            error: rpcResult?.error,
            failedItems: rpcResult?.failedItems
        });
        return {
            success: false,
            error: rpcResult?.error || 'BATCH_FAILED',
            message: rpcResult?.message,
            failedItems: rpcResult?.failedItems
        };
    }

    log.operationSuccess('BATCH_DECREASE_INVENTORY', {
        itemsProcessed: rpcResult.itemsProcessed
    }, Date.now() - startTime);

    return { success: true, results: rpcResult.results };
};

module.exports = {
    checkStockAvailability,
    decreaseInventory,
    restoreInventory,
    batchDecreaseInventory
};
