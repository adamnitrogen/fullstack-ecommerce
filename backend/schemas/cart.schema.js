const { z } = require('zod');

const addToCartSchema = z.object({
    product_id: z.string().uuid('Invalid Product ID'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
    variant_id: z.string().uuid('Invalid Variant ID').optional().nullable()
});

const updateCartSchema = z.object({
    quantity: z.number().int().min(1, 'Quantity must be at least 1')
});

const applyCouponSchema = z.object({
    code: z.string().min(1, 'Coupon code is required')
});

module.exports = {
    addToCartSchema,
    updateCartSchema,
    applyCouponSchema
};
