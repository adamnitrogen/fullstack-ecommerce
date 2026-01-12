const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

// Get all active slides (public)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all slides (admin)
router.get('/admin', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new slide
router.post('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .insert([{
                ...req.body,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update slide
router.put('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('carousel_slides')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete slide
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('carousel_slides')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
