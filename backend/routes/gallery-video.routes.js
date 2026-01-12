const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

// Helper function to extract YouTube video ID from various URL formats
function extractYouTubeId(url) {
    const patterns = [
        /youtu\.be\/([^?]+)/,
        /youtube\.com\/watch\?v=([^&]+)/,
        /youtube\.com\/embed\/([^?]+)/,
        /youtube\.com\/v\/([^?]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// Helper function to generate YouTube thumbnail URL
function getYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

// Get all videos with optional filters
router.get('/', async (req, res) => {
    try {
        let query = supabase
            .from('gallery_videos')
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

// Get single video
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_videos')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get videos by folder
router.get('/folder/:folderId', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_videos')
            .select('*')
            .eq('folder_id', req.params.folderId)
            .order('order_index', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new video
router.post('/', async (req, res) => {
    try {
        const { youtube_url } = req.body;

        // Extract video ID from URL
        const videoId = extractYouTubeId(youtube_url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Generate thumbnail URL
        const thumbnailUrl = getYouTubeThumbnail(videoId);

        const { data, error } = await supabase
            .from('gallery_videos')
            .insert([{
                ...req.body,
                youtube_id: videoId,
                thumbnail_url: thumbnailUrl,
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

// Update video
router.put('/:id', async (req, res) => {
    try {
        let updateData = { ...req.body };

        // If YouTube URL is being updated, re-extract video ID and thumbnail
        if (req.body.youtube_url) {
            const videoId = extractYouTubeId(req.body.youtube_url);
            if (!videoId) {
                return res.status(400).json({ error: 'Invalid YouTube URL' });
            }
            updateData.youtube_id = videoId;
            updateData.thumbnail_url = getYouTubeThumbnail(videoId);
        }

        const { data, error } = await supabase
            .from('gallery_videos')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete video
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('gallery_videos')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
