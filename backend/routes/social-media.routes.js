const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Get all social media links
router.get('/', async (req, res) => {
    try {
        const { isAdmin } = req.query;

        let query = supabase
            .from('social_media')
            .select('*')
            .order('display_order', { ascending: true });

        // Filter by active status for public users
        if (isAdmin !== 'true') {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching social media links:');
        res.status(500).json({ error: error.message });
    }
});

// Create new social media link (admin only)
router.post('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { platform, url, icon, display_order, is_active } = req.body;

        if (!platform || !url) {
            return res.status(400).json({ error: 'Platform and URL are required' });
        }

        const { data, error } = await supabase
            .from('social_media')
            .insert([{
                platform,
                url,
                icon,
                display_order: display_order || 0,
                is_active: is_active !== undefined ? is_active : true
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error creating social media link:');
        res.status(500).json({ error: error.message });
    }
});

// Update social media link (admin only)
router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { platform, url, icon, display_order, is_active } = req.body;

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (platform !== undefined) updateData.platform = platform;
        if (url !== undefined) updateData.url = url;
        if (icon !== undefined) updateData.icon = icon;
        if (display_order !== undefined) updateData.display_order = display_order;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('social_media')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Social media link not found' });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating social media link:');
        res.status(500).json({ error: error.message });
    }
});

// Delete social media link (admin only)
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('social_media')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Social media link deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting social media link:');
        res.status(500).json({ error: error.message });
    }
});

// Reorder links (admin only)
router.put('/reorder/bulk', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { links } = req.body;

        if (!Array.isArray(links)) {
            return res.status(400).json({ error: 'Links array is required' });
        }

        const updates = links.map((link, index) =>
            supabase
                .from('social_media')
                .update({
                    display_order: index,
                    updated_at: new Date().toISOString()
                })
                .eq('id', link.id)
        );

        await Promise.all(updates);

        res.json({ message: 'Social media links reordered successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error reordering social media links:');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
