const { z } = require('zod');

const createPaymentOrderSchema = z.object({
    amount: z.number().positive('Amount must be positive').optional() // Optional: Backend calculates this securely
});

const verifyPaymentSchema = z.object({
    razorpay_order_id: z.string().nullish(),
    razorpay_payment_id: z.string().min(1, 'Razorpay Payment ID is required'),
    razorpay_signature: z.string().nullish(),
    payment_id: z.string().nullish(),
    shipping_address_id: z.string().nullish(),
    billing_address_id: z.string().nullish(),
    notes: z.string().nullish()
});

module.exports = {
    createPaymentOrderSchema,
    verifyPaymentSchema
};
