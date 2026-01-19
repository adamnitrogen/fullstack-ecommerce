/**
 * Delivery Charge Service
 * Handles dynamic delivery charge calculations based on configured rules
 * Supports multiple calculation types: PER_PACKAGE, WEIGHT_BASED, FLAT_PER_ORDER, PER_ITEM
 * 
 * IMPORTANT: All calculations are backend-driven and deterministic
 * Delivery charges must include GST as per requirements
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('DeliveryChargeService');

// Calculation type constants
const CALCULATION_TYPES = {
    FLAT_PER_ORDER: 'FLAT_PER_ORDER',
    PER_PACKAGE: 'PER_PACKAGE',
    WEIGHT_BASED: 'WEIGHT_BASED',
    PER_ITEM: 'PER_ITEM'
};

// Default delivery config (if none exists)
const DEFAULT_CONFIG = {
    calculation_type: CALCULATION_TYPES.FLAT_PER_ORDER,
    base_delivery_charge: 0,
    max_items_per_package: 3,
    unit_weight: 0,
    gst_percentage: 18,
    is_taxable: true,
    delivery_refund_policy: 'REFUNDABLE' // Reverted to Refundable for generic defaults
};

class DeliveryChargeService {
    /**
     * Get delivery configuration for a product/variant
     * Variant config overrides product config if present
     * 
     * @param {string} productId - Product UUID
     * @param {string|null} variantId - Variant UUID (optional)
     * @returns {Promise<object>} Delivery configuration
     */
    static async getDeliveryConfig(productId, variantId = null) {
        try {
            // First, try to get variant-level config if variantId provided
            if (variantId && variantId !== 'null' && variantId !== 'undefined') {
                const { data: variantConfigs, error: variantError } = await supabase
                    .from('delivery_configs')
                    .select('*')
                    .eq('scope', 'VARIANT')
                    .eq('variant_id', variantId)
                    .limit(1);

                const variantConfig = variantConfigs?.[0];

                if (!variantError && variantConfig && variantConfig.is_active !== false) {
                    log.debug('DELIVERY_CONFIG', 'Using variant-level config', { variantId });
                    return {
                        ...variantConfig,
                        source: 'variant',
                        delivery_refund_policy: variantConfig.delivery_refund_policy || 'REFUNDABLE'
                    };
                }
            }

            // Fall back to product-level config
            if (productId && productId !== 'null' && productId !== 'undefined') {
                const { data: productConfigs, error: productError } = await supabase
                    .from('delivery_configs')
                    .select('*')
                    .eq('scope', 'PRODUCT')
                    .eq('product_id', productId)
                    .limit(1);

                const productConfig = productConfigs?.[0];

                if (!productError && productConfig && productConfig.is_active !== false) {
                    log.debug('DELIVERY_CONFIG', 'Using product-level config', { productId });
                    return {
                        ...productConfig,
                        source: 'product',
                        delivery_refund_policy: productConfig.delivery_refund_policy || 'REFUNDABLE'
                    };
                }
            }

            // No config found, use global defaults from Settings Service
            const settingsService = require('./settings.service');
            const globalSettings = await settingsService.getDeliverySettings();

            log.debug('DELIVERY_CONFIG', 'Using global settings', { productId, settings: globalSettings });

            return {
                ...DEFAULT_CONFIG,
                base_delivery_charge: globalSettings.delivery_charge,
                gst_percentage: globalSettings.delivery_gst,
                is_taxable: (globalSettings.delivery_gst > 0),
                source: 'global',
                delivery_refund_policy: 'NON_REFUNDABLE'
                // We don't store threshold here, it's applied at cart level
            };

        } catch (error) {
            log.warn('DELIVERY_CONFIG_ERROR', 'Error fetching delivery config, using default', {
                error: error.message,
                productId,
                variantId
            });
            return { ...DEFAULT_CONFIG, source: 'default' };
        }
    }

    /**
     * Calculate delivery charge for a single product/variant
     * 
     * @param {string} productId - Product UUID
     * @param {string|null} variantId - Variant UUID (optional)
     * @param {number} quantity - Quantity ordered
     * @param {boolean} isFreeDelivery - Whether free delivery applies (for standard/flat rate)
     * @returns {Promise<object>} { deliveryCharge, deliveryGST, totalDelivery, snapshot }
     */
    static async calculateDeliveryCharge(productId, variantId, quantity, isFreeDelivery = false) {
        log.operationStart('CALCULATE_DELIVERY', { productId, variantId, quantity, isFreeDelivery });
        const startTime = Date.now();

        try {
            // Get delivery config
            const config = await this.getDeliveryConfig(productId, variantId);

            let deliveryCharge = 0;
            let calculationDetails = {
                calculation_type: config.calculation_type,
                quantity,
                source: config.source // Audit source
            };

            // Apply calculation logic based on type
            switch (config.calculation_type) {
                case CALCULATION_TYPES.PER_PACKAGE:
                    const packages = Math.ceil(quantity / config.max_items_per_package);
                    deliveryCharge = packages * config.base_delivery_charge;
                    calculationDetails.max_items_per_package = config.max_items_per_package;
                    calculationDetails.packages = packages;
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                case CALCULATION_TYPES.WEIGHT_BASED:
                    const totalWeight = config.unit_weight * quantity;
                    // TODO: Implement courier slab logic based on total weight
                    // For now, using simple linear calculation
                    deliveryCharge = config.base_delivery_charge * Math.ceil(totalWeight);
                    calculationDetails.unit_weight = config.unit_weight;
                    calculationDetails.total_weight = totalWeight;
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                case CALCULATION_TYPES.FLAT_PER_ORDER:
                    // If free delivery applies, standard flat rate is 0
                    if (isFreeDelivery && config.source === 'global') {
                        deliveryCharge = 0;
                        calculationDetails.is_free_delivery_applied = true;
                    } else {
                        deliveryCharge = config.base_delivery_charge;
                    }
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                case CALCULATION_TYPES.PER_ITEM:
                    deliveryCharge = quantity * config.base_delivery_charge;
                    calculationDetails.base_charge = config.base_delivery_charge;
                    break;

                default:
                    log.warn('UNKNOWN_CALCULATION_TYPE', `Unknown calculation type: ${config.calculation_type}`);
                    deliveryCharge = 0;
            }

            // Calculate GST if taxable
            let deliveryGST = 0;

            if (config.is_taxable && config.gst_percentage > 0) {
                // UNIVERSAL INCLUSIVE LOGIC
                // All configured delivery amounts (Global, Product, Variant) ARE the final totals.
                // We reverse-calculate the Base and GST components for compliance and reporting.
                const totalInclusive = deliveryCharge;
                const gstRate = config.gst_percentage;

                // Base = Total / (1 + Rate/100)
                const baseAmount = totalInclusive / (1 + (gstRate / 100));

                deliveryGST = totalInclusive - baseAmount;
                deliveryCharge = baseAmount; // Treat calculated base as the charge portion
            }

            // The final components sum up exactly to the total amount intended
            const totalDelivery = deliveryCharge + deliveryGST;

            // Create snapshot for audit trail
            const snapshot = {
                ...calculationDetails,
                delivery_charge: deliveryCharge,
                gst_rate: config.gst_percentage,
                delivery_gst: deliveryGST,
                is_taxable: config.is_taxable,
                total_delivery: totalDelivery,
                config_id: config.id || null,
                delivery_refund_policy: config.delivery_refund_policy || 'REFUNDABLE'
            };

            log.operationSuccess('CALCULATE_DELIVERY', {
                deliveryCharge: Math.round(deliveryCharge * 100) / 100,
                deliveryGST: Math.round(deliveryGST * 100) / 100,
                totalDelivery: Math.round(totalDelivery * 100) / 100
            }, Date.now() - startTime);

            return {
                deliveryCharge: Math.round(deliveryCharge * 100) / 100,
                deliveryGST: Math.round(deliveryGST * 100) / 100,
                totalDelivery: Math.round(totalDelivery * 100) / 100,
                snapshot
            };

        } catch (error) {
            log.operationError('CALCULATE_DELIVERY', error, { productId, variantId, quantity });
            throw error;
        }
    }

    /**
     * Calculate delivery charges for cart items
     * Aggregates delivery for all items in cart
     * 
     * @param {Array} cartItems - Cart items with product/variant data
     * @param {number} cartSubtotal - Total price of items (for threshold check)
     * @returns {Promise<object>} { totalDeliveryCharge, totalDeliveryGST, totalDelivery, items }
     */
    static async calculateCartDelivery(cartItems, cartSubtotal = 0) {
        log.operationStart('CALCULATE_CART_DELIVERY', { itemCount: cartItems.length, cartSubtotal });
        const startTime = Date.now();

        try {
            // Fetch global settings for threshold
            const settingsService = require('./settings.service');
            const globalSettings = await settingsService.getDeliverySettings();
            const threshold = globalSettings.delivery_threshold || 0;

            // Determine if free delivery applies
            const isFreeDelivery = cartSubtotal >= threshold;

            let totalDeliveryCharge = 0;
            let totalDeliveryGST = 0;
            const itemDeliveries = [];

            let globalChargeApplied = false;

            // Calculate delivery for each item
            for (const item of cartItems) {
                const productId = item.product_id || item.product?.id;
                const variantId = item.variant_id || item.variant?.id;
                const quantity = item.quantity || 1;

                // We need to know the source before deciding to add to totals
                const config = await this.getDeliveryConfig(productId, variantId);
                const isGlobal = config.source === 'global';

                if (isGlobal) {
                    // Global Standard Delivery: Apply only once per order
                    if (!globalChargeApplied) {
                        const result = await this.calculateDeliveryCharge(productId, variantId, quantity, isFreeDelivery);
                        totalDeliveryCharge += result.deliveryCharge;
                        totalDeliveryGST += result.deliveryGST;
                        globalChargeApplied = true;

                        // Mark this item as the one carrying the global charge for this calculation run
                        itemDeliveries.push({
                            product_id: productId,
                            variant_id: variantId,
                            quantity,
                            deliveryCharge: result.deliveryCharge,
                            deliveryGST: result.deliveryGST,
                            totalDelivery: result.totalDelivery,
                            snapshot: result.snapshot
                        });
                    } else {
                        // Other global items don't add to the charge
                        itemDeliveries.push({
                            product_id: productId,
                            variant_id: variantId,
                            quantity,
                            deliveryCharge: 0,
                            deliveryGST: 0,
                            totalDelivery: 0,
                            snapshot: { ...config, source: 'global', base_delivery_charge: 0, applied_as_global: true }
                        });
                    }
                } else {
                    // Product Specific Config
                    // CHECK: Is this a Surcharge (Addition) or Override (Replacement)?
                    // Heuristic: FLAT_PER_ORDER is usually an override. 
                    // PER_ITEM, PER_PACKAGE, WEIGHT_BASED are usually surcharges on top of standard delivery.

                    // User Feedback: All product charges should be ADDITIVE.
                    const isSurcharge = true;

                    if (isSurcharge && !globalChargeApplied) {
                        // If it's a surcharge, we MUST ensure the global base charge is applied AT LEAST ONCE for the cart
                        // We calculate the global charge "virtually" and add it to the totals, 
                        // effectively attributing the base charge to this item for accounting.

                        // Fetch global defaults essentially by calling with nulls
                        const globalResult = await this.calculateDeliveryCharge(null, null, 1, isFreeDelivery);
                        totalDeliveryCharge += globalResult.deliveryCharge;
                        totalDeliveryGST += globalResult.deliveryGST;
                        globalChargeApplied = true;

                        // PUSH VIRTUAL ITEM FOR BREAKDOWN UI
                        itemDeliveries.push({
                            product_id: 'GLOBAL_CHARGE',
                            variant_id: null,
                            quantity: 1,
                            deliveryCharge: globalResult.deliveryCharge,
                            deliveryGST: globalResult.deliveryGST,
                            totalDelivery: globalResult.totalDelivery,
                            snapshot: globalResult.snapshot
                        });

                        log.debug('APPLY_GLOBAL_BASE', 'Applied global base charge due to surcharge item', { productId });
                    }

                    // Product Specific Charge (The Surcharge itself)
                    // Note: Surcharges shouldn't be free just because order > threshold? 
                    // Assuming surcharge is always paid unless specific logic exists.
                    const result = await this.calculateDeliveryCharge(productId, variantId, quantity, false);

                    totalDeliveryCharge += result.deliveryCharge;
                    totalDeliveryGST += result.deliveryGST;

                    itemDeliveries.push({
                        product_id: productId,
                        variant_id: variantId,
                        quantity,
                        deliveryCharge: result.deliveryCharge,
                        deliveryGST: result.deliveryGST,
                        totalDelivery: result.totalDelivery,
                        snapshot: result.snapshot
                    });
                }
            }

            const totalDelivery = totalDeliveryCharge + totalDeliveryGST;

            log.operationSuccess('CALCULATE_CART_DELIVERY', {
                totalDeliveryCharge: Math.round(totalDeliveryCharge * 100) / 100,
                totalDeliveryGST: Math.round(totalDeliveryGST * 100) / 100,
                totalDelivery: Math.round(totalDelivery * 100) / 100,
                isFreeDelivery
            }, Date.now() - startTime);

            return {
                totalDeliveryCharge: Math.round(totalDeliveryCharge * 100) / 100,
                totalDeliveryGST: Math.round(totalDeliveryGST * 100) / 100,
                totalDelivery: Math.round(totalDelivery * 100) / 100,
                items: itemDeliveries
            };

        } catch (error) {
            log.operationError('CALCULATE_CART_DELIVERY', error, { itemCount: cartItems.length });
            throw error;
        }
    }

    /**
     * Calculate delivery charge refund for partial returns
     * ENFORCES delivery_refund_policy: Only refunds delivery if policy is REFUNDABLE
     * Backend is the single source of truth for refund policy enforcement
     * 
     * @param {Array} originalItems - Original order items
     * @param {Array} returnedItems - Items being returned
     * @returns {Promise<object>} { refundDeliveryCharge, refundDeliveryGST, totalRefund, policyDetails, isRefundable }
     */
    static async calculateRefundDelivery(originalItems, returnedItems) {
        log.operationStart('CALCULATE_REFUND_DELIVERY', {
            originalCount: originalItems.length,
            returnCount: returnedItems.length
        });

        try {
            let totalOriginalDelivery = 0;
            let totalOriginalGST = 0;
            let totalRemainingDelivery = 0;
            let totalRemainingGST = 0;
            const policyDetails = [];

            // Group items by product/variant for package calculation
            const itemGroups = new Map();

            // Build item groups from original items
            for (const item of originalItems) {
                const key = `${item.product_id}-${item.variant_id || 'null'}`;
                if (!itemGroups.has(key)) {
                    itemGroups.set(key, {
                        product_id: item.product_id,
                        variant_id: item.variant_id,
                        original_quantity: 0,
                        returned_quantity: 0,
                        delivery_charge: item.delivery_charge || 0,
                        delivery_gst: item.delivery_gst || 0,
                        delivery_refund_policy: null  // Will be fetched
                    });
                }
                const group = itemGroups.get(key);
                group.original_quantity += item.quantity;
                totalOriginalDelivery += item.delivery_charge || 0;
                totalOriginalGST += item.delivery_gst || 0;
            }

            // Add returned quantities
            for (const returnItem of returnedItems) {
                const orderItem = originalItems.find(oi => oi.id === returnItem.orderItemId);
                if (orderItem) {
                    const key = `${orderItem.product_id}-${orderItem.variant_id || 'null'}`;
                    const group = itemGroups.get(key);
                    if (group) {
                        group.returned_quantity += returnItem.quantity;
                    }
                }
            }

            // Recalculate delivery for remaining items + enforce refund policy
            for (const [key, group] of itemGroups) {
                const remainingQuantity = group.original_quantity - group.returned_quantity;

                // Fetch delivery config to get refund policy
                const config = await this.getDeliveryConfig(group.product_id, group.variant_id);
                group.delivery_refund_policy = config.delivery_refund_policy || 'REFUNDABLE';

                // Track policy enforcement for audit trail
                policyDetails.push({
                    product_id: group.product_id,
                    variant_id: group.variant_id,
                    policy: group.delivery_refund_policy,
                    original_delivery: group.delivery_charge,
                    original_gst: group.delivery_gst,
                    returned_quantity: group.returned_quantity,
                    remaining_quantity: remainingQuantity
                });

                // POLICY ENFORCEMENT: Only recalculate if policy allows refunds
                if (group.delivery_refund_policy === 'REFUNDABLE' && remainingQuantity > 0) {
                    // Recalculate delivery for remaining quantity
                    const result = await this.calculateDeliveryCharge(
                        group.product_id,
                        group.variant_id,
                        remainingQuantity
                    );
                    totalRemainingDelivery += result.deliveryCharge;
                    totalRemainingGST += result.deliveryGST;

                    log.debug('REFUND_POLICY_REFUNDABLE', 'Delivery will be refunded', {
                        product_id: group.product_id,
                        original: group.delivery_charge,
                        remaining: result.deliveryCharge
                    });
                } else if (group.delivery_refund_policy === 'NON_REFUNDABLE') {
                    // If non-refundable, remaining delivery = original delivery (no refund)
                    totalRemainingDelivery += group.delivery_charge;
                    totalRemainingGST += group.delivery_gst;

                    log.info('REFUND_POLICY_NON_REFUNDABLE', 'Delivery charge is non-refundable', {
                        product_id: group.product_id,
                        delivery_charge: group.delivery_charge,
                        delivery_gst: group.delivery_gst
                    });
                }
            }

            // Refund is the difference (will be 0 if all products are NON_REFUNDABLE)
            const refundDeliveryCharge = totalOriginalDelivery - totalRemainingDelivery;
            const refundDeliveryGST = totalOriginalGST - totalRemainingGST;
            const totalRefund = refundDeliveryCharge + refundDeliveryGST;

            log.operationSuccess('CALCULATE_REFUND_DELIVERY', {
                originalDelivery: totalOriginalDelivery,
                remainingDelivery: totalRemainingDelivery,
                refundDeliveryCharge: Math.round(refundDeliveryCharge * 100) / 100,
                refundDeliveryGST: Math.round(refundDeliveryGST * 100) / 100,
                policiesApplied: policyDetails.length,
                nonRefundableCount: policyDetails.filter(p => p.policy === 'NON_REFUNDABLE').length
            });

            return {
                originalDeliveryCharge: Math.round(totalOriginalDelivery * 100) / 100,
                originalDeliveryGST: Math.round(totalOriginalGST * 100) / 100,
                remainingDeliveryCharge: Math.round(totalRemainingDelivery * 100) / 100,
                remainingDeliveryGST: Math.round(totalRemainingGST * 100) / 100,
                refundDeliveryCharge: Math.round(refundDeliveryCharge * 100) / 100,
                refundDeliveryGST: Math.round(refundDeliveryGST * 100) / 100,
                totalRefund: Math.round(totalRefund * 100) / 100,
                policyDetails: policyDetails,  // Audit trail showing which policies were applied
                isRefundable: refundDeliveryCharge > 0  // Quick boolean check
            };

        } catch (error) {
            log.operationError('CALCULATE_REFUND_DELIVERY', error);
            throw error;
        }
    }
}

module.exports = { DeliveryChargeService, CALCULATION_TYPES };

