const { PricingCalculator } = require('./services/pricing-calculator.service');
const { TaxEngine } = require('./services/tax-engine.service');

async function testPricing() {
    console.log('Testing Pricing Calculation for Cart Coupon...');

    const cartItems = [
        {
            product: {
                title: 'Test Product',
                price: 1000,
                mrp: 1200,
                category: 'Eco-Products',
                default_gst_rate: 18,
                default_tax_applicable: true,
                default_price_includes_tax: false // Exclusive for easier matching
            },
            quantity: 1,
            product_id: 'p1'
        }
    ];

    const shippingAddress = { state_code: 'KA' }; // Karnataka
    const couponCode = 'WELCOME10'; // Assuming this exists or create it
    const userId = 'user1';

    try {
        const result = await PricingCalculator.calculateCheckoutTotals(cartItems, shippingAddress, couponCode, userId);

        console.log('--- Calculation Result ---');
        console.log('Total MRP:', result.total_mrp);
        console.log('Total Selling Price:', result.total_selling_price);
        console.log('Coupon Code:', result.coupon_code);
        console.log('Coupon Discount:', result.coupon_discount);
        console.log('Final Amount:', result.final_amount);
    } catch (err) {
        console.error('Calculation failed:', err);
    }
}

testPricing();
