const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Get reviews for a product
router.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const { data, error } = await supabase
            .from('reviews')
            .select(`
        *,
        profiles:user_id (
          name,
          avatar_url
        )
      `)
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform data to match frontend expectation
        const reviews = data.map(review => ({
            id: review.id,
            productId: review.product_id,
            userId: review.user_id,
            userName: review.profiles?.name || 'Anonymous',
            userAvatar: review.profiles?.avatar_url,
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            verified: review.is_verified,
            createdAt: review.created_at
        }));

        res.json(reviews);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching reviews:');
        res.status(500).json({ error: error.message });
    }
});

// Get all reviews (Admin/Manager)
router.get('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        const { data, count, error } = await supabase
            .from('reviews')
            .select(`
        *,
        profiles:user_id (
          name,
          avatar_url
        ),
        products:product_id (
          title,
          images
        )
      `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(start, end);

        if (error) throw error;

        const reviews = data.map(review => ({
            id: review.id,
            productId: review.product_id,
            productName: review.products?.title || 'Unknown Product',
            productImage: review.products?.images?.[0] || null,
            userId: review.user_id,
            userName: review.profiles?.name || 'Anonymous',
            userAvatar: review.profiles?.avatar_url,
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            verified: review.is_verified,
            createdAt: review.created_at
        }));

        res.json({
            reviews,
            total: count,
            page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching all reviews:');
        res.status(500).json({ error: error.message });
    }
});

// Create a new review - Authenticated
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { productId, userId, rating, title, comment } = req.body;

        // Basic validation
        if (!productId || !userId || !rating || !title || !comment) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('reviews')
            .insert([
                {
                    product_id: productId,
                    user_id: userId,
                    rating,
                    title,
                    comment
                }
            ])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error creating review:');
        res.status(500).json({ error: error.message });
    }
});

// Delete a review (Admin/Manager only)
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('reviews')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting review:');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
