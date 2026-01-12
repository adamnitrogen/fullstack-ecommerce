const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { deletePhotoByUrl } = require('../services/photo.service');

// Get all items with optional filters
router.get('/', async (req, res) => {
    try {
        let query = supabase
            .from('gallery_items')
            .select('*');

        // Filter by folder
        if (req.query.folder_id) {
            query = query.eq('folder_id', req.query.folder_id);
        }

        // Filter by tags
        if (req.query.tags) {
            const tags = req.query.tags.split(',');
            query = query.contains('tags', tags);
        }

        query = query.order('order_index', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single item
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_items')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get items by folder
router.get('/folder/:folderId', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_items')
            .select('*')
            .eq('folder_id', req.params.folderId)
            .order('order_index', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new item
router.post('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_items')
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

// Update item
router.put('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_items')
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

// Delete item (also removes from storage)
router.delete('/:id', async (req, res) => {
    try {
        // Fetch the item to get the image URL
        const { data: item, error: fetchError } = await supabase
            .from('gallery_items')
            .select('image_url')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        // Delete from database
        const { error: deleteError } = await supabase
            .from('gallery_items')
            .delete()
            .eq('id', req.params.id);

        if (deleteError) throw deleteError;

        // Asynchronously clean up storage and photos table
        if (item?.image_url) {
            deletePhotoByUrl(item.image_url).catch(err => {
                logger.error({ err: err }, 'Failed to delete gallery item storage:');
            });
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
