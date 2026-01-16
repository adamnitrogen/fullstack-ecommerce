const { z } = require('zod');

const createVariantSchema = z.object({
    size_label: z.string(),
    mrp: z.number(),
    selling_price: z.number(),
});

const updateVariantSchema = z.object({
    id: z.string().uuid(),
    size_label: z.string().optional(),
    mrp: z.number().optional(),
    selling_price: z.number().optional(),
});

// Current problematic order
const problematicUnion = z.union([createVariantSchema, updateVariantSchema]);

// Proposed fixed order
const fixedUnion = z.union([updateVariantSchema, createVariantSchema]);

const testData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    size_label: 'Test Variant',
    mrp: 100,
    selling_price: 80
};

console.log('Test Data:', testData);

const result1 = problematicUnion.safeParse(testData);
console.log('\nResult with PROBLEMATIC union (create first):');
if (result1.success) {
    console.log('Success!', result1.data);
    console.log('Has ID?', !!result1.data.id);
} else {
    console.log('Failed!', result1.error.format());
}

const result2 = fixedUnion.safeParse(testData);
console.log('\nResult with FIXED union (update first):');
if (result2.success) {
    console.log('Success!', result2.data);
    console.log('Has ID?', !!result2.data.id);
} else {
    console.log('Failed!', result2.error.format());
}
