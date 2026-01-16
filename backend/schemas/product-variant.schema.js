const { z } = require('zod');

/**
 * Product Variant Validation Schemas
 * Uses Zod for strict type validation with descriptive error messages
 */

// Valid unit types for variants
const VARIANT_UNITS = ['kg', 'gm', 'ltr', 'ml', 'pcs'];
const VARIANT_MODES = ['UNIT', 'SIZE'];

/**
 * Schema for creating a single variant
 */
const createVariantSchema = z.object({
    size_label: z
        .string()
        .min(1, 'Size label is required')
        .max(50, 'Size label must be 50 characters or less'),
    size_value: z
        .number()
        .positive('Size value must be positive')
        .optional()
        .nullable(),
    unit: z
        .enum(VARIANT_UNITS, {
            errorMap: () => ({ message: `Unit must be one of: ${VARIANT_UNITS.join(', ')}` })
        })
        .optional()
        .nullable()
        .default('kg'),
    description: z.string().optional().nullable(), // Required if mode is SIZE (checked in superRefine)
    mrp: z
        .number()
        .positive('MRP must be positive'),
    selling_price: z
        .number()
        .positive('Selling price must be positive'),
    stock_quantity: z
        .number()
        .int('Stock quantity must be an integer')
        .min(0, 'Stock quantity cannot be negative')
        .default(0),
    variant_image_url: z
        .string()
        .url('Invalid image URL')
        .optional()
        .nullable(),
    is_default: z
        .boolean()
        .default(false),
    // GST/Tax Fields
    hsn_code: z
        .string()
        .max(8, 'HSN code must be 8 characters or less')
        .regex(/^\d{4,8}$/, 'HSN code must be 4-8 digits')
        .or(z.literal(''))
        .optional()
        .nullable(),
    gst_rate: z
        .number()
        .refine(val => val === undefined || val === null || [0, 5, 12, 18, 28].includes(val), {
            message: 'GST rate must be one of: 0, 5, 12, 18, 28'
        })
        .optional()
        .nullable(),
    tax_applicable: z
        .boolean()
        .default(false),
    price_includes_tax: z
        .boolean()
        .default(true),
    razorpay_item_id: z
        .string()
        .optional()
        .nullable()
}).refine(
    (data) => data.selling_price <= data.mrp,
    {
        message: 'Selling price must be less than or equal to MRP',
        path: ['selling_price']
    }
).refine(
    (data) => {
        // If tax_applicable is true, gst_rate should be provided
        if (data.tax_applicable && (data.gst_rate === null || data.gst_rate === undefined)) {
            return false;
        }
        return true;
    },
    {
        message: 'GST rate is required when tax is applicable',
        path: ['gst_rate']
    }
);

/**
 * Schema for updating a variant
 */
const updateVariantSchema = z.object({
    id: z
        .string()
        .uuid('Invalid variant ID'),
    razorpay_item_id: z
        .string()
        .optional()
        .nullable(),
    size_label: z
        .string()
        .min(1)
        .max(50)
        .optional(),
    size_value: z
        .number()
        .positive()
        .optional()
        .nullable(),
    unit: z
        .enum(VARIANT_UNITS)
        .optional()
        .nullable(),
    description: z.string().optional().nullable(),
    mrp: z
        .number()
        .positive()
        .optional(),
    selling_price: z
        .number()
        .positive()
        .optional(),
    stock_quantity: z
        .number()
        .int()
        .min(0)
        .optional(),
    variant_image_url: z
        .string()
        .url()
        .optional()
        .nullable(),
    is_default: z
        .boolean()
        .optional(),
    // GST/Tax Fields
    hsn_code: z
        .string()
        .max(8)
        .regex(/^\d{4,8}$/)
        .or(z.literal(''))
        .optional()
        .nullable(),
    gst_rate: z
        .number()
        .refine(val => val === undefined || val === null || [0, 5, 12, 18, 28].includes(val), {
            message: 'GST rate must be one of: 0, 5, 12, 18, 28'
        })
        .optional()
        .nullable(),
    tax_applicable: z
        .boolean()
        .optional(),
    price_includes_tax: z
        .boolean()
        .optional()
}).refine(
    (data) => {
        if (data.selling_price !== undefined && data.mrp !== undefined) {
            return data.selling_price <= data.mrp;
        }
        return true;
    },
    {
        message: 'Selling price must be less than or equal to MRP',
        path: ['selling_price']
    }
);

/**
 * Schema for creating a product with variants
 */
const createProductWithVariantsSchema = z.object({
    product: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().min(1, 'Description is required'),
        category: z.string().min(1, 'Category is required'),
        variant_mode: z.enum(VARIANT_MODES).default('UNIT').optional(),
        price: z.number().min(0, 'Price must be non-negative').optional(),
        mrp: z.number().min(0, 'MRP must be non-negative').optional(),
        inventory: z.number().int().min(0).optional().default(0),
        images: z.array(z.string().url()).min(1, 'At least one image is required'),
        tags: z.array(z.string()).optional().default([]),
        benefits: z.array(z.string()).optional().default([]),
        isReturnable: z.boolean().optional().default(true),
        returnDays: z.number().int().min(0).optional().default(3),
        default_hsn_code: z.string().max(8).regex(/^\d{4,8}$/).or(z.literal('')).optional().nullable(),
        default_gst_rate: z.number().refine(val => val === undefined || val === null || [0, 5, 12, 18, 28].includes(val)).optional().nullable(),
        default_tax_applicable: z.boolean().default(false).optional(),
        default_price_includes_tax: z.boolean().default(true).optional(),
        createdAt: z.string().optional()
    }),
    variants: z
        .array(createVariantSchema)
        .optional()
        .default([])
}).superRefine((data, ctx) => {
    // 1. Validate Price/MRP existence
    const hasVariants = data.variants && data.variants.length > 0;
    const hasPrice = data.product.price !== undefined && data.product.price > 0; // Handle 0 as missing
    const hasMrp = data.product.mrp !== undefined && data.product.mrp > 0;

    if (!hasVariants) {
        if (!hasPrice) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Price is required when no variants are present',
                path: ['product', 'price']
            });
        }
        if (!hasMrp) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'MRP is required when no variants are present',
                path: ['product', 'mrp']
            });
        }
    } else {
        // Variant Validation Check based on Variant Mode
        const mode = data.product.variant_mode || 'UNIT';

        data.variants.forEach((variant, index) => {
            if (mode === 'SIZE') {
                if (!variant.description || variant.description.trim() === '') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Description is required for Size-based variants',
                        path: ['variants', index, 'description']
                    });
                }
            } else {
                // UNIT mode
                if (!variant.size_value) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Size Value is required for Unit-based variants',
                        path: ['variants', index, 'size_value']
                    });
                }
            }
        });
    }

    // 2. Validate Price <= MRP logic (only if both exist)
    if (hasPrice && hasMrp && data.product.price > data.product.mrp) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Selling price must be less than or equal to MRP',
            path: ['product', 'price']
        });
    }

    // 3. Validate at least one default variant (only if variants exist)
    if (hasVariants) {
        const hasDefault = data.variants.some(v => v.is_default);
        if (!hasDefault && data.variants.length > 1) {
            if (data.variants.length > 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'One variant must be marked as default',
                    path: ['variants']
                });
            }
        }
    }
});

/**
 * Schema for updating a product with variants
 */
const updateProductWithVariantsSchema = z.object({
    product: z.object({
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        brand: z.string().min(1).optional(),
        variant_mode: z.enum(VARIANT_MODES).optional(),
        price: z.number().min(0).optional(),
        mrp: z.number().min(0).optional(),
        inventory: z.number().int().min(0).optional(),
        images: z.array(z.string().url()).optional(),
        tags: z.array(z.string()).optional(),
        benefits: z.array(z.string()).optional(),
        isReturnable: z.boolean().optional(),
        returnDays: z.number().int().min(0).optional(),
        default_hsn_code: z.string().max(8).regex(/^\d{4,8}$/).or(z.literal('')).optional().nullable(),
        default_gst_rate: z.number().refine(val => val === undefined || val === null || [0, 5, 12, 18, 28].includes(val)).optional().nullable(),
        default_tax_applicable: z.boolean().optional(),
        default_price_includes_tax: z.boolean().optional(),
        createdAt: z.string().optional()
    }).optional(),
    variants: z
        .array(
            z.union([
                updateVariantSchema,
                createVariantSchema
            ])
        )
        .optional()
});

/**
 * Schema for adding to cart with variant
 */
const addToCartWithVariantSchema = z.object({
    product_id: z.string().uuid('Invalid product ID'),
    variant_id: z.string().uuid('Invalid variant ID').optional().nullable(),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1)
});

module.exports = {
    createVariantSchema,
    updateVariantSchema,
    createProductWithVariantsSchema,
    updateProductWithVariantsSchema,
    addToCartWithVariantSchema,
    VARIANT_UNITS,
    VARIANT_MODES
};
