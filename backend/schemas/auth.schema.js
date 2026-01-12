const { z } = require('zod');

const passwordValidation = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
});

const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: passwordValidation,
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().optional(),
    otpVerified: z.boolean().optional()
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordValidation
}).refine(data => data.currentPassword !== data.newPassword, {
    message: "New password cannot be the same as current password",
    path: ["newPassword"]
});

module.exports = {
    loginSchema,
    registerSchema,
    changePasswordSchema
};
