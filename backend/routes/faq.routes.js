const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// Get all FAQs (public - only active FAQs, admin - all FAQs)
router.get('/', async (req, res) => {
    try {
        const { category, isAdmin } = req.query;

        let query = supabase
            .from('faqs')
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name
        )
      `)
            .order('display_order', { ascending: true });

        // Filter by active status for public users
        if (isAdmin !== 'true') {
            query = query.eq('is_active', true);
        }

        // Filter by category if provided
        if (category) {
            query = query.eq('category_id', category);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching FAQs');
        res.status(500).json({ error: error.message });
    }
});

// Get single FAQ by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('faqs')
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name
        )
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'FAQ not found' });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error fetching FAQ');
        res.status(500).json({ error: error.message });
    }
});

// Create new FAQ (admin only)
router.post('/', async (req, res) => {
    try {
        const { question, answer, category_id, display_order, is_active } = req.body;

        // Validation
        if (!question || !answer || !category_id) {
            return res.status(400).json({
                error: 'Question, answer, and category are required'
            });
        }

        const { data, error } = await supabase
            .from('faqs')
            .insert([{
                question,
                answer,
                category_id,
                display_order: display_order || 0,
                is_active: is_active !== undefined ? is_active : true
            }])
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name
        )
      `)
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error creating FAQ');
        res.status(500).json({ error: error.message });
    }
});

// Update FAQ (admin only)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, category_id, display_order, is_active } = req.body;

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (question !== undefined) updateData.question = question;
        if (answer !== undefined) updateData.answer = answer;
        if (category_id !== undefined) updateData.category_id = category_id;
        if (display_order !== undefined) updateData.display_order = display_order;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('faqs')
            .update(updateData)
            .eq('id', id)
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name
        )
      `)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'FAQ not found' });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error updating FAQ');
        res.status(500).json({ error: error.message });
    }
});

// Toggle FAQ active status (admin only)
router.patch('/:id/toggle-active', async (req, res) => {
    try {
        const { id } = req.params;

        // Get current status
        const { data: currentFaq, error: fetchError } = await supabase
            .from('faqs')
            .select('is_active')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!currentFaq) {
            return res.status(404).json({ error: 'FAQ not found' });
        }

        // Toggle status
        const { data, error } = await supabase
            .from('faqs')
            .update({
                is_active: !currentFaq.is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select(`
        *,
        category:categories!faqs_category_id_fkey (
          id,
          name
        )
      `)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error toggling FAQ status');
        res.status(500).json({ error: error.message });
    }
});

// Delete FAQ (admin only)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('faqs')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'FAQ deleted successfully' });
    } catch (error) {
        logger.error({ err: error, faqId: req.params.id }, 'Error deleting FAQ');
        res.status(500).json({ error: error.message });
    }
});

// Reorder FAQs (admin only)
router.put('/reorder/bulk', async (req, res) => {
    try {
        const { faqs } = req.body;

        if (!Array.isArray(faqs)) {
            return res.status(400).json({ error: 'FAQs array is required' });
        }

        // Update each FAQ's display_order
        const updates = faqs.map((faq, index) =>
            supabase
                .from('faqs')
                .update({
                    display_order: index,
                    updated_at: new Date().toISOString()
                })
                .eq('id', faq.id)
        );

        await Promise.all(updates);

        res.json({ message: 'FAQs reordered successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error reordering FAQs');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
