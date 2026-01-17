/**
 * Delivery Configs API Routes
 * Admin-only routes for managing delivery configuration rules
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('DeliveryConfigsRoutes');

/**
 * Get delivery config for a product
 * GET /api/admin/delivery-configs/product/:productId
 */
router.get('/product/:productId', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { productId } = req.params;

        const { data, error } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('scope', 'PRODUCT')
            .eq('product_id', productId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = No rows returned
            throw error;
        }

        res.json({ config: data || null });
    } catch (error) {
        log.operationError('GET_PRODUCT_CONFIG', error, { productId: req.params.productId });
        res.status(500).json({ error: 'Failed to fetch delivery config' });
    }
});

/**
 * Get delivery config for a variant
 * GET /api/admin/delivery-configs/variant/:variantId
 */
router.get('/variant/:variantId', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { variantId } = req.params;

        const { data, error } = await supabase
            .from('delivery_configs')
            .select('*')
            .eq('scope', 'VARIANT')
            .eq('variant_id', variantId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({ config: data || null });
    } catch (error) {
        log.operationError('GET_VARIANT_CONFIG', error, { variantId: req.params.variantId });
        res.status(500).json({ error: 'Failed to fetch delivery config' });
    }
});

/**
 * Create or update delivery config
 * POST /api/admin/delivery-configs
 * Admin only
 */
router.post('/', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const {
            scope,
            product_id,
            variant_id,
            calculation_type,
            base_delivery_charge,
            max_items_per_package,
            unit_weight,
            gst_percentage,
            is_taxable,
            delivery_refund_policy
        } = req.body;

        // Validation
        if (!scope || !['PRODUCT', 'VARIANT'].includes(scope)) {
            return res.status(400).json({ error: 'Invalid scope. Must be PRODUCT or VARIANT' });
        }

        if (scope === 'PRODUCT' && !product_id) {
            return res.status(400).json({ error: 'product_id is required for PRODUCT scope' });
        }

        if (scope === 'VARIANT' && !variant_id) {
            return res.status(400).json({ error: 'variant_id is required for VARIANT scope' });
        }

        if (!calculation_type || !['FLAT_PER_ORDER', 'PER_PACKAGE', 'WEIGHT_BASED', 'PER_ITEM'].includes(calculation_type)) {
            return res.status(400).json({ error: 'Invalid calculation_type' });
        }

        if (base_delivery_charge < 0) {
            return res.status(400).json({ error: 'base_delivery_charge cannot be negative' });
        }

        if (calculation_type === 'PER_PACKAGE' && (!max_items_per_package || max_items_per_package < 1)) {
            return res.status(400).json({ error: 'max_items_per_package must be >= 1 for PER_PACKAGE calculation' });
        }

        if (delivery_refund_policy && !['REFUNDABLE', 'NON_REFUNDABLE'].includes(delivery_refund_policy)) {
            return res.status(400).json({ error: 'delivery_refund_policy must be REFUNDABLE or NON_REFUNDABLE' });
        }

        const configData = {
            scope,
            product_id: scope === 'PRODUCT' ? product_id : null,
            variant_id: scope === 'VARIANT' ? variant_id : null,
            calculation_type,
            base_delivery_charge,
            max_items_per_package: max_items_per_package || 3,
            unit_weight: unit_weight || null,
            gst_percentage: gst_percentage || 18,
            is_taxable: is_taxable !== undefined ? is_taxable : true,
            delivery_refund_policy: delivery_refund_policy || 'REFUNDABLE',
            updated_at: new Date().toISOString()
        };

        // Upsert (insert or update)
        const { data, error } = await supabase
            .from('delivery_configs')
            .upsert(configData, {
                onConflict: scope === 'PRODUCT' ? 'product_id' : 'variant_id'
            })
            .select()
            .single();

        if (error) throw error;

        log.info('DELIVERY_CONFIG_SAVED', 'Delivery config created/updated', {
            scope,
            id: data.id,
            calculation_type
        });

        res.json({ config: data });
    } catch (error) {
        log.operationError('SAVE_DELIVERY_CONFIG', error, { body: req.body });
        res.status(500).json({ error: 'Failed to save delivery config' });
    }
});

/**
 * Delete delivery config
 * DELETE /api/admin/delivery-configs/:id
 * Admin only
 */
router.delete('/:id', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('delivery_configs')
            .delete()
            .eq('id', id);

        if (error) throw error;

        log.info('DELIVERY_CONFIG_DELETED', 'Delivery config deleted', { id });

        res.json({ message: 'Delivery config deleted successfully' });
    } catch (error) {
        log.operationError('DELETE_DELIVERY_CONFIG', error, { id: req.params.id });
        res.status(500).json({ error: 'Failed to delete delivery config' });
    }
});

/**
 * Get all delivery configs (for admin overview)
 * GET /api/admin/delivery-configs
 * Admin only
 */
router.get('/', authenticateToken, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('delivery_configs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ configs: data });
    } catch (error) {
        log.operationError('GET_ALL_CONFIGS', error);
        res.status(500).json({ error: 'Failed to fetch delivery configs' });
    }
});

module.exports = router;
