const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

// Helper to map snake_case DB object to camelCase frontend object
const mapToFrontend = (blog) => {
    if (!blog) return null;
    return {
        id: blog.id,
        title: blog.title,
        excerpt: blog.excerpt,
        content: blog.content,
        author: blog.author,
        date: blog.date,
        image: blog.image,
        tags: blog.tags || [],
        published: blog.published,
        createdAt: blog.created_at,
        updatedAt: blog.updated_at
    };
};

// Helper to map camelCase frontend object to snake_case DB object
const mapToDb = (blog) => {
    const dbBlog = {
        title: blog.title,
        excerpt: blog.excerpt,
        content: blog.content,
        author: blog.author,
        date: blog.date,
        image: blog.image,
        tags: blog.tags,
        published: blog.published,
        updated_at: new Date().toISOString()
    };

    // Remove undefined fields
    Object.keys(dbBlog).forEach(key => dbBlog[key] === undefined && delete dbBlog[key]);

    return dbBlog;
};

// Get all blogs (with optional pagination and search)
router.get('/', async (req, res) => {
    try {
        const { page, limit, search } = req.query;

        let query = supabase
            .from('blogs')
            .select('*', { count: 'exact' });

        // Apply search if provided
        if (search) {
            query = query.ilike('title', `%${search}%`);
        }

        // Apply pagination if provided
        if (page && limit) {
            const from = (page - 1) * limit;
            const to = from + parseInt(limit) - 1;
            query = query.range(from, to);
        }

        const { data, count, error } = await query.order('date', { ascending: false });

        if (error) throw error;

        const formattedBlogs = data.map(mapToFrontend);

        // If pagination was requested, return object with data and total
        if (page && limit) {
            res.json({
                blogs: formattedBlogs,
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            });
        } else {
            // Backward compatibility: return array
            res.json(formattedBlogs);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single blog
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('blogs')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json(mapToFrontend(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create blog
router.post('/', async (req, res) => {
    try {
        const dbBlog = mapToDb(req.body);
        // Add created_at for new records
        dbBlog.created_at = new Date().toISOString();
        // Set date if not provided
        if (!dbBlog.date) dbBlog.date = new Date().toISOString();

        const { data, error } = await supabase
            .from('blogs')
            .insert([dbBlog])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(mapToFrontend(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update blog
router.put('/:id', async (req, res) => {
    try {
        const dbBlog = mapToDb(req.body);

        const { data, error } = await supabase
            .from('blogs')
            .update(dbBlog)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(mapToFrontend(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete blog
router.delete('/:id', async (req, res) => {
    try {
        // 1. Get blog to find image URL
        const { data: blog, error: fetchError } = await supabase
            .from('blogs')
            .select('image')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Delete blog from database first
        const { error } = await supabase
            .from('blogs')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        // 3. Clean up blog image from storage and photos table
        if (blog && blog.image) {
            const { deletePhotoByUrl } = require('../services/photo.service');
            // Don't await - let cleanup happen asynchronously
            deletePhotoByUrl(blog.image).catch(err =>
                logger.error('Error cleaning up blog image:', err)
            );
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
