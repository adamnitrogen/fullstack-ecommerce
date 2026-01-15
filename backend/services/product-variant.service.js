const supabase = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('ProductVariantService');

/**
 * Product Variant Service
 * Handles CRUD operations for product size variants with proper logging
 */

/**
 * @typedef {Object} ProductVariant
 * @property {string} id
 * @property {string} product_id
 * @property {string} size_label
 * @property {number} size_value
 * @property {string} unit
 * @property {number} mrp
 * @property {number} selling_price
 * @property {number} stock_quantity
 * @property {string|null} variant_image_url
 * @property {boolean} is_default
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} VariantCreateData
 * @property {string} size_label
 * @property {number} size_value
 * @property {string} unit
 * @property {string} [description]
 * @property {number} mrp
 * @property {number} selling_price
 * @property {number} stock_quantity
 * @property {string} [variant_image_url]
 * @property {boolean} [is_default]
 */

/**
 * Get all variants for a product
 * @param {string} productId - Product UUID
 * @returns {Promise<ProductVariant[]>}
 */
async function getVariantsByProductId(productId) {
    log.operationStart('GET_VARIANTS_BY_PRODUCT', { productId });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('size_value', { ascending: true });

    if (error) {
        log.operationError('GET_VARIANTS_BY_PRODUCT', error, { productId });
        throw error;
    }

    log.operationSuccess('GET_VARIANTS_BY_PRODUCT', {
        productId,
        variantCount: data?.length || 0
    }, Date.now() - startTime);

    return data || [];
}

/**
 * Get a single variant by ID
 * @param {string} variantId - Variant UUID
 * @returns {Promise<ProductVariant|null>}
 */
async function getVariantById(variantId) {
    log.operationStart('GET_VARIANT_BY_ID', { variantId });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('id', variantId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            log.debug('GET_VARIANT_BY_ID', 'Variant not found', { variantId });
            return null;
        }
        log.operationError('GET_VARIANT_BY_ID', error, { variantId });
        throw error;
    }

    log.operationSuccess('GET_VARIANT_BY_ID', { variantId }, Date.now() - startTime);
    return data;
}

/**
 * Get the default variant for a product
 * @param {string} productId - Product UUID
 * @returns {Promise<ProductVariant|null>}
 */
async function getDefaultVariant(productId) {
    log.operationStart('GET_DEFAULT_VARIANT', { productId });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_default', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            log.debug('GET_DEFAULT_VARIANT', 'No default variant found', { productId });
            return null;
        }
        log.operationError('GET_DEFAULT_VARIANT', error, { productId });
        throw error;
    }

    log.operationSuccess('GET_DEFAULT_VARIANT', { productId, variantId: data?.id }, Date.now() - startTime);
    return data;
}

/**
 * Create a new variant for a product
 * @param {string} productId - Product UUID
 * @param {VariantCreateData} variantData - Variant data
 * @returns {Promise<ProductVariant>}
 */
async function createVariant(productId, variantData) {
    log.operationStart('CREATE_VARIANT', {
        productId,
        sizeLabel: variantData.size_label,
        isDefault: variantData.is_default
    });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .insert({
            product_id: productId,
            size_label: variantData.size_label,
            size_value: variantData.size_value,
            unit: variantData.unit || 'kg',
            description: variantData.description || null, // Added description
            mrp: variantData.mrp,
            selling_price: variantData.selling_price,
            stock_quantity: variantData.stock_quantity || 0,
            variant_image_url: variantData.variant_image_url || null,
            is_default: variantData.is_default || false
        })
        .select()
        .single();

    if (error) {
        log.operationError('CREATE_VARIANT', error, { productId, sizeLabel: variantData.size_label });
        throw error;
    }

    log.operationSuccess('CREATE_VARIANT', {
        variantId: data.id,
        productId,
        sizeLabel: data.size_label
    }, Date.now() - startTime);

    return data;
}

/**
 * Update an existing variant
 * @param {string} variantId - Variant UUID
 * @param {Partial<VariantCreateData>} updates - Fields to update
 * @returns {Promise<ProductVariant>}
 */
async function updateVariant(variantId, updates) {
    log.operationStart('UPDATE_VARIANT', { variantId, updateFields: Object.keys(updates) });
    const startTime = Date.now();

    const { data, error } = await supabase
        .from('product_variants')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', variantId)
        .select()
        .single();

    if (error) {
        log.operationError('UPDATE_VARIANT', error, { variantId });
        throw error;
    }

    log.operationSuccess('UPDATE_VARIANT', { variantId, sizeLabel: data.size_label }, Date.now() - startTime);
    return data;
}

/**
 * Delete a variant
 * @param {string} variantId - Variant UUID
 * @returns {Promise<void>}
 */
async function deleteVariant(variantId) {
    log.operationStart('DELETE_VARIANT', { variantId });
    const startTime = Date.now();

    // Get variant info for logging before deletion
    const variant = await getVariantById(variantId);

    const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

    if (error) {
        log.operationError('DELETE_VARIANT', error, { variantId });
        throw error;
    }

    log.operationSuccess('DELETE_VARIANT', {
        variantId,
        productId: variant?.product_id,
        sizeLabel: variant?.size_label
    }, Date.now() - startTime);
}

/**
 * Set a variant as the default for its product
 * @param {string} productId - Product UUID
 * @param {string} variantId - Variant UUID to set as default
 * @returns {Promise<ProductVariant>}
 */
async function setDefaultVariant(productId, variantId) {
    log.operationStart('SET_DEFAULT_VARIANT', { productId, variantId });
    const startTime = Date.now();

    // The trigger in the database handles unsetting other defaults
    const { data, error } = await supabase
        .from('product_variants')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', variantId)
        .eq('product_id', productId)
        .select()
        .single();

    if (error) {
        log.operationError('SET_DEFAULT_VARIANT', error, { productId, variantId });
        throw error;
    }

    log.operationSuccess('SET_DEFAULT_VARIANT', {
        productId,
        variantId,
        sizeLabel: data.size_label
    }, Date.now() - startTime);

    return data;
}

/**
 * Create a product with variants atomically using RPC
 * @param {Object} productData - Product data
 * @param {VariantCreateData[]} variants - Array of variant data
 * @returns {Promise<{id: string, variant_ids: string[]}>}
 */
async function createProductWithVariants(productData, variants) {
    log.operationStart('CREATE_PRODUCT_WITH_VARIANTS', {
        title: productData.title,
        variantCount: variants.length
    });
    const startTime = Date.now();

    // Constraint: Inventory must match sum of variant stocks if variants exist
    if (variants && variants.length > 0) {
        const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
        productData.inventory = totalStock;
        log.info('CREATE_PRODUCT_WITH_VARIANTS', `Calculated total inventory from ${variants.length} variants: ${totalStock}`);

        // Logic: If Price/MRP are missing, calculate from variants (Lowest Selling Price Strategy)
        if (!productData.price || !productData.mrp) {
            // Find variant with lowest selling price to represent "Starting from"
            const cheapestVariant = variants.reduce((min, curr) =>
                (curr.selling_price < min.selling_price) ? curr : min
                , variants[0]);

            if (!productData.price) {
                productData.price = cheapestVariant.selling_price;
                log.info('CREATE_PRODUCT_WITH_VARIANTS', `Auto-setting product price to ${cheapestVariant.selling_price} from variant ${cheapestVariant.size_label}`);
            }

            if (!productData.mrp) {
                // Ideally use the MRP of the cheapest variant to keep discount scaling consistent
                productData.mrp = cheapestVariant.mrp;
                log.info('CREATE_PRODUCT_WITH_VARIANTS', `Auto-setting product MRP to ${cheapestVariant.mrp} from variant ${cheapestVariant.size_label}`);
            }
        }
    }


    const { data, error } = await supabase.rpc('create_product_with_variants', {
        p_product_data: productData,
        p_variants: variants
    });

    if (error) {
        log.operationError('CREATE_PRODUCT_WITH_VARIANTS', error, { title: productData.title });
        throw error;
    }

    log.operationSuccess('CREATE_PRODUCT_WITH_VARIANTS', {
        productId: data.id,
        variantIds: data.variant_ids,
        variantCount: data.variant_ids?.length || 0
    }, Date.now() - startTime);

    return data;
}

/**
 * Update a product with variants atomically using RPC
 * @param {string} productId - Product UUID
 * @param {Object} productData - Product data to update
 * @param {Array} variants - Array of variant data (with id for update, without for create)
 * @returns {Promise<{id: string, updated_variants: string[], new_variants: string[]}>}
 */
async function updateProductWithVariants(productId, productData, variants) {
    log.operationStart('UPDATE_PRODUCT_WITH_VARIANTS', {
        productId,
        variantCount: variants?.length || 0
    });
    const startTime = Date.now();

    // Constraint: Inventory must match sum of variant stocks if variants exist
    if (variants && variants.length > 0) {
        const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
        // Ensure productData exists or create it
        productData = productData || {};
        productData.inventory = totalStock;

        // Logic: If Price/MRP are missing (and not deliberately set to null/0 by update), recalculate
        // Note: For updates, we usually only update what's passed. But if price is passed as 0 or undefined AND we have variants, we might want to recalc.
        // For safety in this "optional UI" context, let's say if the user saves with empty price, frontend sends 0 or null.
        // We re-evaluate if price is falsy.
        if (!productData.price || !productData.mrp) {
            const cheapestVariant = variants.reduce((min, curr) =>
                (curr.selling_price < min.selling_price) ? curr : min
                , variants[0]);

            if (!productData.price) {
                productData.price = cheapestVariant.selling_price;
                log.info('UPDATE_PRODUCT_WITH_VARIANTS', `Auto-setting product price to ${cheapestVariant.selling_price}`);
            }
            if (!productData.mrp) {
                productData.mrp = cheapestVariant.mrp;
                log.info('UPDATE_PRODUCT_WITH_VARIANTS', `Auto-setting product MRP to ${cheapestVariant.mrp}`);
            }
        }

        log.info('UPDATE_PRODUCT_WITH_VARIANTS', `Calculated total inventory from ${variants.length} variants: ${totalStock}`);
    }

    const { data, error } = await supabase.rpc('update_product_with_variants', {
        p_product_id: productId,
        p_product_data: productData,
        p_variants: variants
    });

    if (error) {
        log.operationError('UPDATE_PRODUCT_WITH_VARIANTS', error, { productId });
        throw error;
    }

    log.operationSuccess('UPDATE_PRODUCT_WITH_VARIANTS', {
        productId: data.id,
        updatedVariants: data.updated_variants?.length || 0,
        newVariants: data.new_variants?.length || 0
    }, Date.now() - startTime);

    return data;
}

/**
 * Check stock availability for a variant
 * @param {string} variantId - Variant UUID
 * @param {number} requestedQuantity - Quantity to check
 * @returns {Promise<{available: boolean, currentStock: number}>}
 */
async function checkVariantStock(variantId, requestedQuantity) {
    log.debug('CHECK_VARIANT_STOCK', 'Checking stock availability', { variantId, requestedQuantity });

    const variant = await getVariantById(variantId);

    if (!variant) {
        log.warn('CHECK_VARIANT_STOCK', 'Variant not found', { variantId });
        return { available: false, currentStock: 0 };
    }

    const available = variant.stock_quantity >= requestedQuantity;

    log.debug('CHECK_VARIANT_STOCK', 'Stock check result', {
        variantId,
        currentStock: variant.stock_quantity,
        requestedQuantity,
        available
    });

    return {
        available,
        currentStock: variant.stock_quantity
    };
}

/**
 * Decrease variant stock (for order placement)
 * @param {string} variantId - Variant UUID
 * @param {number} quantity - Quantity to decrease
 * @returns {Promise<ProductVariant>}
 */
async function decreaseVariantStock(variantId, quantity) {
    log.operationStart('DECREASE_VARIANT_STOCK', { variantId, quantity });
    const startTime = Date.now();

    const { data, error } = await supabase.rpc('decrease_variant_stock', {
        p_variant_id: variantId,
        p_quantity: quantity
    });

    if (error) {
        log.operationError('DECREASE_VARIANT_STOCK', error, { variantId, quantity });
        throw error;
    }

    log.operationSuccess('DECREASE_VARIANT_STOCK', {
        variantId,
        decreasedBy: quantity,
        newStock: data?.stock_quantity
    }, Date.now() - startTime);

    return data;
}

module.exports = {
    getVariantsByProductId,
    getVariantById,
    getDefaultVariant,
    createVariant,
    updateVariant,
    deleteVariant,
    setDefaultVariant,
    createProductWithVariants,
    updateProductWithVariants,
    checkVariantStock,
    decreaseVariantStock
};
