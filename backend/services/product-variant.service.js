const supabase = require('../config/supabase');
const { createModuleLogger } = require('../utils/logging-standards');
const RazorpaySyncService = require('./razorpay-sync.service');

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
            size_label: variant_data.size_label,
            size_value: variant_data.size_value,
            unit: variant_data.unit || 'kg',
            description: variant_data.description || null, // Added description
            mrp: variant_data.mrp,
            selling_price: variant_data.selling_price,
            stock_quantity: variant_data.stock_quantity || 0,
            variant_image_url: variant_data.variant_image_url || null,
            is_default: variant_data.is_default || false,
            delivery_charge: variant_data.delivery_charge !== undefined ? variant_data.delivery_charge : null,
            // GST Fields
            hsn_code: variant_data.hsn_code || null,
            gst_rate: variant_data.gst_rate !== undefined ? variant_data.gst_rate : 0,
            tax_applicable: variant_data.tax_applicable !== undefined ? variant_data.tax_applicable : true,
            price_includes_tax: variant_data.price_includes_tax !== undefined ? variant_data.price_includes_tax : true
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

    // --- RAZORPAY SYNC START ---
    try {
        const { data: product } = await supabase.from('products').select('title').eq('id', productId).single();
        const productName = product?.title || 'Product';

        await RazorpaySyncService.createItem({
            name: `${productName} - ${data.size_label}`,
            description: data.description || `Variant: ${data.size_label}`,
            amount: data.selling_price * 100,
            currency: 'INR',
            hsn_code: data.hsn_code,
            tax_rate: data.gst_rate,
            tax_inclusive: data.price_includes_tax
        }).then(async (item) => {
            if (item?.id) {
                await supabase.from('product_variants').update({ razorpay_item_id: item.id }).eq('id', data.id);
                data.razorpay_item_id = item.id;
            }
        });
    } catch (err) {
        log.error('RAZORPAY_SYNC_FAIL', 'Failed to sync variant to Razorpay', { error: err.message });
    }
    // --- RAZORPAY SYNC END ---

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

    // --- RAZORPAY SYNC UPDATE ---
    if (data.razorpay_item_id) {
        RazorpaySyncService.updateItem(data.razorpay_item_id, {
            amount: data.selling_price * 100,
            description: data.description
        }).catch(err => log.error('RAZORPAY_UPDATE_FAIL', err));
    }
    // ---------------------------

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

    // --- RAZORPAY SYNC DELETE ---
    if (variant?.razorpay_item_id) {
        RazorpaySyncService.deleteItem(variant.razorpay_item_id).catch(err =>
            log.error('RAZORPAY_DELETE_FAIL', err, { itemId: variant.razorpay_item_id })
        );
    }
    // ---------------------------
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
        productId: data?.id,
        variantIds: data?.variant_ids,
        variantCount: data?.variant_ids?.length || 0
    }, Date.now() - startTime);

    // --- POST-TRANSACTION RAZORPAY SYNC ---
    // User Requirement: Sync only AFTER successful creation
    if (data.variant_ids && data.variant_ids.length > 0) {
        // Run asynchronously to not block response
        (async () => {
            try {
                // Fetch the created variants to get price/tax details
                const { data: createdVariants } = await supabase
                    .from('product_variants')
                    .select('*')
                    .in('id', data.variant_ids);

                if (createdVariants) {
                    for (const variant of createdVariants) {
                        try {
                            // Reuse logic via service call wrapper or direct sync
                            // Using direct sync here to avoid redundant fetch in createVariant (though createVariant has it too, this path bypasses createVariant)

                            // Re-fetch product title if needed, or use productData.title
                            const itemName = `${productData.title} - ${variant.size_label}`;

                            const rzpItem = await RazorpaySyncService.createItem({
                                name: itemName,
                                description: variant.description || `Variant: ${variant.size_label}`,
                                amount: variant.selling_price * 100,
                                currency: 'INR',
                                hsn_code: variant.hsn_code,
                                tax_rate: variant.gst_rate,
                                tax_inclusive: variant.price_includes_tax
                            });

                            if (rzpItem?.id) {
                                await supabase.from('product_variants')
                                    .update({ razorpay_item_id: rzpItem.id })
                                    .eq('id', variant.id);
                            }
                        } catch (itemSyncErr) {
                            log.error('SYNC_VARIANT_FAIL', itemSyncErr, { variantId: variant.id });
                        }
                    }
                }
            } catch (err) {
                log.error('POST_CREATE_SYNC_FAIL', err);
            }
        })();
    }
    // -------------------------------------

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
        productId: data?.id,
        updatedVariants: data?.updated_variants?.length || 0,
        newVariants: data?.new_variants?.length || 0
    }, Date.now() - startTime);

    // --- POST-TRANSACTION RAZORPAY SYNC ---
    const allAffectedVariantIds = [
        ...(data.updated_variants || []),
        ...(data.new_variants || [])
    ];

    if (allAffectedVariantIds.length > 0) {
        (async () => {
            try {
                const { data: variants } = await supabase
                    .from('product_variants')
                    .select('*')
                    .in('id', allAffectedVariantIds);

                if (variants) {
                    // We need product title for creating new items name
                    const { data: product } = await supabase.from('products').select('title').eq('id', productId).single();
                    const productTitle = product?.title || 'Product';

                    for (const variant of variants) {
                        try {
                            // If it already has an ID, update it. If not, create it.
                            // BUT, even "updated" variants might be new to Razorpay if they were made before this feature.
                            // Logic: If razorpay_item_id exists, UPDATE. Else CREATE.

                            const itemName = `${productTitle} - ${variant.size_label}`;
                            const itemPayload = {
                                name: itemName,
                                description: variant.description || `Variant: ${variant.size_label}`,
                                amount: variant.selling_price * 100,
                                currency: 'INR',
                                hsn_code: variant.hsn_code,
                                tax_rate: variant.gst_rate,
                                tax_inclusive: variant.price_includes_tax
                            };

                            if (variant.razorpay_item_id) {
                                // UPDATE
                                await RazorpaySyncService.updateItem(variant.razorpay_item_id, itemPayload);
                            } else {
                                // CREATE
                                const rzpItem = await RazorpaySyncService.createItem(itemPayload);
                                if (rzpItem?.id) {
                                    await supabase.from('product_variants')
                                        .update({ razorpay_item_id: rzpItem.id })
                                        .eq('id', variant.id);
                                }
                            }
                        } catch (err) {
                            log.error('SYNC_UPDATE_VARIANT_FAIL', err, { variantId: variant.id });
                        }
                    }
                }
            } catch (err) {
                log.error('POST_UPDATE_SYNC_FAIL', err);
            }
        })();
    }
    // -------------------------------------

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
