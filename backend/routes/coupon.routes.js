const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { getActiveCoupons } = require('../services/coupon.service');

/**
 * Coupon Routes
 * Admin-only endpoints for managing discount coupons
 */

// Get all coupons (admin only)
router.get('/', async (req, res) => {
    try {
        const { type, is_active, expired } = req.query;

        let query = supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (type) {
            query = query.eq('type', type);
        }

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        const { data, error } = await query;

        if (error) throw error;

        // Filter expired coupons if requested
        let coupons = data;
        if (expired !== undefined) {
            const now = new Date();
            if (expired === 'true') {
                coupons = data.filter(c => new Date(c.valid_until) < now);
            } else if (expired === 'false') {
                coupons = data.filter(c => new Date(c.valid_until) >= now);
            }
        }

        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get active coupons for promotional banners (public)
router.get('/active', async (req, res) => {
    try {
        const coupons = await getActiveCoupons();
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single coupon by ID (admin only)
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new coupon (admin only)
router.post('/', async (req, res) => {
    try {
        const {
            code,
            type,
            discount_percentage,
            target_id,
            min_purchase_amount,
            max_discount_amount,
            valid_from,
            valid_until,
            usage_limit,
            is_active
        } = req.body;

        // Validation
        if (!code || !type || !discount_percentage || !valid_until) {
            return res.status(400).json({
                error: 'Missing required fields: code, type, discount_percentage, valid_until'
            });
        }

        if (discount_percentage < 1 || discount_percentage > 100) {
            return res.status(400).json({
                error: 'Discount percentage must be between 1 and 100'
            });
        }

        if (!['product', 'category', 'cart'].includes(type)) {
            return res.status(400).json({
                error: 'Type must be one of: product, category, cart'
            });
        }

        // Ensure code is uppercase
        const upperCode = code.toUpperCase();

        // Check for duplicate code
        const { data: existing } = await supabase
            .from('coupons')
            .select('id')
            .eq('code', upperCode)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Coupon code already exists' });
        }

        const { data, error } = await supabase
            .from('coupons')
            .insert([{
                code: upperCode,
                type,
                discount_percentage,
                target_id,
                min_purchase_amount: min_purchase_amount || 0,
                max_discount_amount,
                valid_from: valid_from || new Date().toISOString(),
                valid_until,
                usage_limit,
                is_active: is_active !== undefined ? is_active : true
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update coupon (admin only)
router.put('/:id', async (req, res) => {
    try {
        const {
            code,
            type,
            discount_percentage,
            target_id,
            min_purchase_amount,
            max_discount_amount,
            valid_from,
            valid_until,
            usage_limit,
            is_active
        } = req.body;

        // Build update object
        const updates = {};

        if (code !== undefined) updates.code = code.toUpperCase();
        if (type !== undefined) updates.type = type;
        if (discount_percentage !== undefined) {
            if (discount_percentage < 1 || discount_percentage > 100) {
                return res.status(400).json({
                    error: 'Discount percentage must be between 1 and 100'
                });
            }
            updates.discount_percentage = discount_percentage;
        }
        if (target_id !== undefined) updates.target_id = target_id;
        if (min_purchase_amount !== undefined) updates.min_purchase_amount = min_purchase_amount;
        if (max_discount_amount !== undefined) updates.max_discount_amount = max_discount_amount;
        if (valid_from !== undefined) updates.valid_from = valid_from;
        if (valid_until !== undefined) updates.valid_until = valid_until;
        if (usage_limit !== undefined) updates.usage_limit = usage_limit;
        if (is_active !== undefined) updates.is_active = is_active;

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('coupons')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete coupon (soft delete - set inactive) (admin only)
router.delete('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('coupons')
            .update({ is_active: false })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json({ message: 'Coupon deactivated successfully', coupon: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
