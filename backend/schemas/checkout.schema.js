const { z } = require('zod');

const createPaymentOrderSchema = z.object({
    amount: z.number().positive('Amount must be positive').optional() // Optional: Backend calculates this securely
});

const verifyPaymentSchema = z.object({
    razorpay_order_id: z.string().min(1, 'Razorpay Order ID is required'),
    razorpay_payment_id: z.string().min(1, 'Razorpay Payment ID is required'),
    razorpay_signature: z.string().min(1, 'Razorpay Signature is required'),
    payment_id: z.string().optional(),
    shipping_address_id: z.string().uuid('Invalid Shipping Address ID'),
    billing_address_id: z.string().uuid('Invalid Billing Address ID'),
    notes: z.string().optional()
});

module.exports = {
    createPaymentOrderSchema,
    verifyPaymentSchema
};
