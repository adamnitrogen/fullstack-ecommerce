const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { deletePhotosByUrls } = require('../services/photo.service');

// Get all folders with their first image
router.get('/', async (req, res) => {
    try {
        const { data: folders, error } = await supabase
            .from('gallery_folders')
            .select(`
                *,
                gallery_items (
                    image_url,
                    thumbnail_url
                )
            `)
            .order('order_index', { ascending: true })
            .order('order_index', { foreignTable: 'gallery_items', ascending: true })
            .limit(1, { foreignTable: 'gallery_items' });

        if (error) throw error;

        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single folder with items and videos
router.get('/:id', async (req, res) => {
    try {
        const { data: folder, error: folderError } = await supabase
            .from('gallery_folders')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (folderError) throw folderError;

        // Get items for this folder
        const { data: items, error: itemsError } = await supabase
            .from('gallery_items')
            .select('*')
            .eq('folder_id', req.params.id)
            .order('order_index', { ascending: true });

        if (itemsError) throw itemsError;

        // Get videos for this folder
        const { data: videos, error: videosError } = await supabase
            .from('gallery_videos')
            .select('*')
            .eq('folder_id', req.params.id)
            .order('order_index', { ascending: true });

        if (videosError) throw videosError;

        res.json({
            ...folder,
            items: items || [],
            videos: videos || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new folder
router.post('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_folders')
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

// Update folder
router.put('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_folders')
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

// Set folder as home carousel
router.put('/:id/set-carousel', async (req, res) => {
    try {
        // First, set all folders is_home_carousel to false
        const { error: resetError } = await supabase
            .from('gallery_folders')
            .update({ is_home_carousel: false })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

        if (resetError) throw resetError;

        // Then set the selected folder to true
        const { data, error } = await supabase
            .from('gallery_folders')
            .update({ is_home_carousel: true })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete folder (cascades to items and videos)
router.delete('/:id', async (req, res) => {
    try {
        // 1. Fetch all items in this folder to get their image URLs
        const { data: items, error: itemsError } = await supabase
            .from('gallery_items')
            .select('image_url')
            .eq('folder_id', req.params.id);

        if (itemsError) throw itemsError;

        // 2. Delete images from storage
        if (items && items.length > 0) {
            const imageUrls = items.map(item => item.image_url).filter(url => url);
            if (imageUrls.length > 0) {
                await deletePhotosByUrls(imageUrls);
            }
        }

        // 3. Delete folder from database (cascades to items and videos)
        const { error } = await supabase
            .from('gallery_folders')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
