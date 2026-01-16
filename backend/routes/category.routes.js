const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

// Get all categories (with optional type filter)
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;

        let query = supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        // Filter by type if provided
        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching categories');
        res.status(500).json({ error: error.message });
    }
});

// Get single category
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, categoryId: req.params.id }, 'Error fetching category');
        res.status(500).json({ error: error.message });
    }
});

const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Create category - Admin/Manager only
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, type = 'product' } = req.body;

        // Validate type
        if (!['product', 'event', 'faq', 'gallery'].includes(type)) {
            return res.status(400).json({
                error: 'Invalid category type. Must be: product, event, faq, or gallery'
            });
        }

        const { data, error } = await supabase
            .from('categories')
            .insert([{ name, type }])
            .select()
            .single();

        if (error) throw error;

        logger.info({ categoryId: data.id, name, type }, 'Category created');
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error creating category');
        res.status(500).json({ error: error.message });
    }
});

// Update category - Admin/Manager only
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { name, type } = req.body;

        // Validate type if provided
        if (type && !['product', 'event', 'faq', 'gallery'].includes(type)) {
            return res.status(400).json({
                error: 'Invalid category type. Must be: product, event, faq, or gallery'
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (type !== undefined) updateData.type = type;

        const { data, error } = await supabase
            .from('categories')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        logger.info({ categoryId: req.params.id, updates: Object.keys(updateData) }, 'Category updated');
        res.json(data);
    } catch (error) {
        logger.error({ err: error, categoryId: req.params.id }, 'Error updating category');
        res.status(500).json({ error: error.message });
    }
});

// Delete category - Admin/Manager only
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        logger.info({ categoryId: req.params.id }, 'Category deleted');
        res.status(204).send();
    } catch (error) {
        logger.error({ err: error, categoryId: req.params.id }, 'Error deleting category');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
