const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logging-standards');
const productVariantService = require('../services/product-variant.service');
const {
    createVariantSchema,
    updateVariantSchema,
    createProductWithVariantsSchema,
    updateProductWithVariantsSchema
} = require('../schemas/product-variant.schema');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const validateBody = (schema) => validate(schema, 'body');
const validateParams = (schema) => validate(schema, 'params');
const { z } = require('zod');

const log = createModuleLogger('ProductVariantRoutes');

// UUID validation schema
const uuidParamsSchema = z.object({
    productId: z.string().uuid('Invalid product ID'),
    variantId: z.string().uuid('Invalid variant ID').optional()
});

// ============================================================================
// ADMIN ROUTES - Require admin/manager role
// ============================================================================

/**
 * GET /admin/products/:productId/variants
 * Get all variants for a product
 */
router.get(
    '/admin/products/:productId/variants',
    authenticateToken,
    requireRole('admin', 'manager'),
    async (req, res) => {
        const { productId } = req.params;
        log.operationStart('GET_PRODUCT_VARIANTS', { productId, userId: req.user?.id });
        const startTime = Date.now();

        try {
            const variants = await productVariantService.getVariantsByProductId(productId);

            log.operationSuccess('GET_PRODUCT_VARIANTS', {
                productId,
                variantCount: variants.length
            }, Date.now() - startTime);

            res.json({ variants });
        } catch (error) {
            log.operationError('GET_PRODUCT_VARIANTS', error, { productId });
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * POST /admin/products/:productId/variants
 * Create a new variant for a product
 */
router.post(
    '/admin/products/:productId/variants',
    authenticateToken,
    requireRole('admin', 'manager'),
    async (req, res) => {
        const { productId } = req.params;
        log.operationStart('CREATE_VARIANT', { productId, userId: req.user?.id });
        const startTime = Date.now();

        try {
            // Validate request body
            const validationResult = createVariantSchema.safeParse(req.body);
            if (!validationResult.success) {
                const errors = (validationResult.error.issues || []).map(e => ({
                    field: e.path.join('.'),
                    message: e.message
                }));
                log.warn('CREATE_VARIANT', 'Validation failed', { productId, errors });
                return res.status(400).json({ error: 'Validation failed', details: errors });
            }

            const variant = await productVariantService.createVariant(productId, validationResult.data);

            log.operationSuccess('CREATE_VARIANT', {
                productId,
                variantId: variant.id,
                sizeLabel: variant.size_label
            }, Date.now() - startTime);

            res.status(201).json({ variant });
        } catch (error) {
            log.operationError('CREATE_VARIANT', error, { productId });

            // Handle unique constraint violation
            if (error.code === '23505') {
                return res.status(409).json({
                    error: 'A variant with this size already exists for this product'
                });
            }

            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * PUT /admin/products/:productId/variants/:variantId
 * Update a variant
 */
router.put(
    '/admin/products/:productId/variants/:variantId',
    authenticateToken,
    requireRole('admin', 'manager'),
    async (req, res) => {
        const { productId, variantId } = req.params;
        log.operationStart('UPDATE_VARIANT', { productId, variantId, userId: req.user?.id });
        const startTime = Date.now();

        try {
            // Validate variant belongs to product
            const existingVariant = await productVariantService.getVariantById(variantId);
            if (!existingVariant) {
                log.warn('UPDATE_VARIANT', 'Variant not found', { variantId });
                return res.status(404).json({ error: 'Variant not found' });
            }
            if (existingVariant.product_id !== productId) {
                log.warn('UPDATE_VARIANT', 'Variant does not belong to product', { variantId, productId });
                return res.status(400).json({ error: 'Variant does not belong to this product' });
            }

            // Validate selling_price <= mrp if both provided
            const updates = req.body;
            const newMrp = updates.mrp !== undefined ? updates.mrp : existingVariant.mrp;
            const newSellingPrice = updates.selling_price !== undefined ? updates.selling_price : existingVariant.selling_price;

            if (newSellingPrice > newMrp) {
                return res.status(400).json({
                    error: 'Selling price must be less than or equal to MRP'
                });
            }

            const variant = await productVariantService.updateVariant(variantId, updates);

            log.operationSuccess('UPDATE_VARIANT', {
                variantId,
                sizeLabel: variant.size_label
            }, Date.now() - startTime);

            res.json({ variant });
        } catch (error) {
            log.operationError('UPDATE_VARIANT', error, { productId, variantId });
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * DELETE /admin/products/:productId/variants/:variantId
 * Delete a variant
 */
router.delete(
    '/admin/products/:productId/variants/:variantId',
    authenticateToken,
    requireRole('admin', 'manager'),
    async (req, res) => {
        const { productId, variantId } = req.params;
        log.operationStart('DELETE_VARIANT', { productId, variantId, userId: req.user?.id });
        const startTime = Date.now();

        try {
            // Validate variant exists and belongs to product
            const existingVariant = await productVariantService.getVariantById(variantId);
            if (!existingVariant) {
                log.warn('DELETE_VARIANT', 'Variant not found', { variantId });
                return res.status(404).json({ error: 'Variant not found' });
            }
            if (existingVariant.product_id !== productId) {
                log.warn('DELETE_VARIANT', 'Variant does not belong to product', { variantId, productId });
                return res.status(400).json({ error: 'Variant does not belong to this product' });
            }

            // Check if this is the only variant
            const allVariants = await productVariantService.getVariantsByProductId(productId);
            if (allVariants.length === 1) {
                log.warn('DELETE_VARIANT', 'Cannot delete last variant', { variantId, productId });
                return res.status(400).json({
                    error: 'Cannot delete the only variant. Products must have at least one variant.'
                });
            }

            await productVariantService.deleteVariant(variantId);

            log.operationSuccess('DELETE_VARIANT', { variantId, productId }, Date.now() - startTime);

            res.status(204).send();
        } catch (error) {
            log.operationError('DELETE_VARIANT', error, { productId, variantId });
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * POST /admin/products/:productId/variants/:variantId/set-default
 * Set a variant as the default
 */
router.post(
    '/admin/products/:productId/variants/:variantId/set-default',
    authenticateToken,
    requireRole('admin', 'manager'),
    async (req, res) => {
        const { productId, variantId } = req.params;
        log.operationStart('SET_DEFAULT_VARIANT', { productId, variantId, userId: req.user?.id });
        const startTime = Date.now();

        try {
            const variant = await productVariantService.setDefaultVariant(productId, variantId);

            log.operationSuccess('SET_DEFAULT_VARIANT', {
                variantId,
                productId,
                sizeLabel: variant.size_label
            }, Date.now() - startTime);

            res.json({ variant });
        } catch (error) {
            log.operationError('SET_DEFAULT_VARIANT', error, { productId, variantId });
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * POST /admin/products-with-variants
 * Create a product with variants atomically
 */
router.post(
    '/admin/products-with-variants',
    authenticateToken,
    requireRole('admin', 'manager'),
    async (req, res) => {
        log.operationStart('CREATE_PRODUCT_WITH_VARIANTS', { userId: req.user?.id });
        const startTime = Date.now();

        try {
            // Validate request body
            const validationResult = createProductWithVariantsSchema.safeParse(req.body);
            if (!validationResult.success) {
                const errors = (validationResult.error.issues || []).map(e => ({
                    field: e.path.join('.'),
                    message: e.message
                }));
                log.warn('CREATE_PRODUCT_WITH_VARIANTS', 'Validation failed', { errors });
                return res.status(400).json({ error: 'Validation failed', details: errors });
            }

            const { product, variants } = validationResult.data;
            const result = await productVariantService.createProductWithVariants(product, variants);

            log.operationSuccess('CREATE_PRODUCT_WITH_VARIANTS', {
                productId: result.id,
                variantCount: result.variant_ids?.length || 0
            }, Date.now() - startTime);

            res.status(201).json(result);
        } catch (error) {
            log.operationError('CREATE_PRODUCT_WITH_VARIANTS', error, {});
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * PUT /admin/products-with-variants/:productId
 * Update a product and its variants atomically
 */
router.put(
    '/admin/products-with-variants/:productId',
    authenticateToken,
    requireRole('admin', 'manager'),
    async (req, res) => {
        const { productId } = req.params;
        log.operationStart('UPDATE_PRODUCT_WITH_VARIANTS', { productId, userId: req.user?.id });
        const startTime = Date.now();

        try {
            // Validate request body
            const validationResult = updateProductWithVariantsSchema.safeParse(req.body);
            if (!validationResult.success) {
                const errors = (validationResult.error.issues || []).map(e => ({
                    field: e.path.join('.'),
                    message: e.message
                }));
                log.warn('UPDATE_PRODUCT_WITH_VARIANTS', 'Validation failed', { productId, errors });
                return res.status(400).json({ error: 'Validation failed', details: errors });
            }

            const { product, variants } = validationResult.data;

            const result = await productVariantService.updateProductWithVariants(
                productId,
                product || {},
                variants || []
            );

            log.operationSuccess('UPDATE_PRODUCT_WITH_VARIANTS', {
                productId: result.id,
                updatedVariants: result.updated_variants?.length || 0,
                newVariants: result.new_variants?.length || 0
            }, Date.now() - startTime);

            res.json(result);
        } catch (error) {
            log.operationError('UPDATE_PRODUCT_WITH_VARIANTS', error, { productId });
            res.status(500).json({ error: error.message });
        }
    }
);

// ============================================================================
// PUBLIC ROUTES - For fetching variant info
// ============================================================================

/**
 * GET /products/:productId/variants
 * Public endpoint to get all variants for a product
 */
router.get(
    '/products/:productId/variants',
    async (req, res) => {
        const { productId } = req.params;
        log.debug('GET_PUBLIC_VARIANTS', 'Fetching variants for product', { productId });

        try {
            const variants = await productVariantService.getVariantsByProductId(productId);
            res.json({ variants });
        } catch (error) {
            log.operationError('GET_PUBLIC_VARIANTS', error, { productId });
            res.status(500).json({ error: error.message });
        }
    }
);

module.exports = router;
