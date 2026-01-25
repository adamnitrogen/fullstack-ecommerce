const { z } = require('zod');

const createReviewSchema = z.object({
    productId: z.string().uuid('Invalid product ID'),
    userId: z.string().uuid('Invalid user ID'),
    rating: z.number()
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating cannot exceed 5')
        .int('Rating must be an integer'),
    title: z.string()
        .trim()
        .min(2, 'Title is too short')
        .max(100, 'Title is too long'),
    comment: z.string()
        .trim()
        .min(10, 'Review comment must be at least 10 characters')
        .max(2000, 'Review comment is too long')
});

module.exports = {
    createReviewSchema
};
