const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

// Get all testimonials
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single testimonial
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create testimonial
router.post('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('testimonials')
            .insert([{
                ...req.body,
                approved: true,  // Auto-approve testimonials
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

// Update testimonial
router.put('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('testimonials')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete testimonial
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('testimonials')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
