
const { PricingCalculator } = require('./services/pricing-calculator.service');
const { DeliveryChargeService } = require('./services/delivery-charge.service');
const { TaxEngine } = require('./services/tax-engine.service');

// Mock CartService dependencies
const mockCart = {
    id: 'c1',
    applied_coupon_code: 'FREEDELIVERY',
    cart_items: [
        {
            id: 'ci1',
            product_id: 'p1',
            quantity: 1,
            products: { id: 'p1', title: 'Test Product', price: 1000 },
            product_variants: { id: 'v1', selling_price: 1000 }
        }
    ]
};

// Mock PricingCalculator method used by CartService
const originalCalc = PricingCalculator.calculateCheckoutTotals;

async function runTest() {
    console.log('--- Testing CartService -> PricingCalculator Argument Order ---');

    // We want to verify that when CartService calls calculateCheckoutTotals, 
    // the 3rd argument is actually the coupon code.

    let capturedArgs = null;
    PricingCalculator.calculateCheckoutTotals = async (...args) => {
        capturedArgs = args;
        return {
            items_count: 1,
            total_mrp: 1000,
            total_selling_price: 1000,
            mrp_discount: 0,
            coupon_discount: 0,
            delivery_charge: 0,
            delivery_gst: 0,
            final_amount: 1000,
            items: [],
            tax: { total_tax: 0 }
        };
    };

    // Require CartService AFTER mocking PricingCalculator to ensure it uses the mock
    // Wait, CartService might have already been required. 
    // Let's use the actual file path or delete from cache if needed.
    delete require.cache[require.resolve('./services/cart.service')];
    const cartService = require('./services/cart.service');

    // Mock getUserCart inside cartService (it uses supabase config usually)
    // For this test, we skip database and pass existingCart

    await cartService.calculateCartTotals('user1', null, mockCart);

    console.log('Captured Arguments passed to PricingCalculator:');
    console.log('0: Items (Array):', Array.isArray(capturedArgs[0]));
    console.log('1: Address (should be null):', capturedArgs[1]);
    console.log('2: CouponCode (should be FREEDELIVERY):', capturedArgs[2]);
    console.log('3: UserId (should be user1):', capturedArgs[3]);

    if (capturedArgs[2] === 'FREEDELIVERY' && capturedArgs[3] === 'user1') {
        console.log('✅ PASS: Argument order is CORRECT.');
    } else {
        console.error('❌ FAIL: Argument order is WRONG!');
        console.error(`Expected: [items, null, 'FREEDELIVERY', 'user1']`);
        console.error(`Received: [items, ${capturedArgs[1]}, ${capturedArgs[2]}, ${capturedArgs[3]}]`);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
