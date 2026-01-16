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
 * Check if all items have sufficient stock (variant-aware)
 * @param {Array} items - Array of { product_id, variant_id, quantity } or cart items
 * @returns {Promise<{ available: boolean, insufficientItems: Array }>}
 */
const checkStockAvailability = async (items) => {
    log.operationStart('CHECK_STOCK', { itemCount: items.length });
    const startTime = Date.now();
    const insufficientItems = [];

    for (const item of items) {
        const productId = item.product_id || item.product?.id;
        const variantId = item.variant_id || item.variant?.id || null;
        const quantity = item.quantity || 1;

        if (!productId) {
            log.warn('CHECK_STOCK', 'Skipping item without product_id', { item });
            continue;
        }

        let availableStock = 0;
        let itemTitle = 'Product';
        let variantLabel = null;

        if (variantId) {
            // Check variant stock
            const { data: variant, error: variantError } = await supabase
                .from('product_variants')
                .select('stock_quantity, size_label, products(title)')
                .eq('id', variantId)
                .single();

            if (variantError || !variant) {
                log.warn('CHECK_STOCK', 'Variant not found', { variantId, error: variantError?.message });
                insufficientItems.push({
                    product_id: productId,
                    variant_id: variantId,
                    requested: quantity,
                    available: 0,
                    message: 'Variant not found'
                });
                continue;
            }

            availableStock = variant.stock_quantity || 0;
            itemTitle = variant.products?.title || 'Product';
            variantLabel = variant.size_label;
        } else {
            // Check product inventory
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

            availableStock = product.inventory || 0;
            itemTitle = product.title;
        }

        if (availableStock < quantity) {
            const label = variantLabel ? `${itemTitle} - ${variantLabel}` : itemTitle;
            log.debug('CHECK_STOCK', 'Insufficient stock', {
                productId,
                variantId,
                title: label,
                requested: quantity,
                available: availableStock
            });
            insufficientItems.push({
                product_id: productId,
                variant_id: variantId,
                title: label,
                requested: quantity,
                available: availableStock,
                message: `Only ${availableStock} units available`
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
            items: insufficientItems.map(i => ({ productId: i.product_id, variantId: i.variant_id, requested: i.requested, available: i.available }))
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

        // Extract variant_id if present
        const variantId = item.variant_id || item.variant?.id || null;

        // Use variant-aware atomic PostgreSQL function with row-level locking
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('decrement_inventory_atomic_v2', {
                p_product_id: productId,
                p_quantity: quantity,
                p_variant_id: variantId,
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

        // Extract variant_id if present
        const variantId = item.variant_id || item.variant?.id || item.variant_snapshot?.variant_id || null;

        // Use variant-aware atomic PostgreSQL function
        const { data: rpcResult, error: rpcError } = await supabase
            .rpc('increment_inventory_atomic_v2', {
                p_product_id: productId,
                p_quantity: quantity,
                p_variant_id: variantId,
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
