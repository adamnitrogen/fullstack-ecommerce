// Manual Mocks Setup
const settingsService = require('./services/settings.service');
const { DeliveryChargeService } = require('./services/delivery-charge.service');
const { TaxEngine } = require('./services/tax-engine.service');
const couponService = require('./services/coupon.service');

// Override methods
settingsService.getDeliverySettings = async () => ({
    delivery_threshold: 5000,
    delivery_charge: 100, // Inclusive
    delivery_gst: 18
});

// Mock TaxEngine
TaxEngine.calculateOrderTax = (items) => {
    let total = 0;
    items.forEach(i => total += i.unitPrice * i.quantity);
    return {
        summary: {
            total_amount: total,
            total_tax: 0,
            tax_type: 'INTRA_STATE',
            total_taxable_amount: total,
            total_cgst: 0,
            total_sgst: 0,
            total_igst: 0,
            seller_state_code: 'S1',
            buyer_state_code: 'S1'
        },
        items: items.map(i => ({ ...i, taxBreakdown: { tax_type: 'INTRA_STATE' } }))
    };
};

// Mock Coupon Service
couponService.validateCoupon = async (code, userId) => {
    // console.log(`Validating coupon: ${code} for user ${userId}`);
    if (code === 'FREEDELIVERY') {
        return {
            valid: true,
            coupon: { code: 'FREEDELIVERY', type: 'free_delivery', discount_percentage: 0 }
        };
    }
    return { valid: false, error: 'Invalid coupon' };
};

couponService.calculateCouponDiscount = () => ({ totalDiscount: 0, itemDiscounts: [] });


// Import SUT (System Under Test)
const { PricingCalculator } = require('./services/pricing-calculator.service');

async function runTests() {
    console.log('--- STARTING PRICING INTEGRATION TESTS (MANUAL MOCKS) ---');

    const items = [{
        product_id: 'p1',
        quantity: 1,
        unitPrice: 1393,
        unitMrp: 1393,
        product: { price: 1393, mrp: 1393 }
    }];

    // SCENARIO 1: Standard Delivery (No Coupon)
    console.log('\n--> SCENARIO 1: Standard Delivery (No Coupon)');

    // Mock Delivery for Scenario 1
    const originalCalculate = DeliveryChargeService.calculateCartDelivery;
    DeliveryChargeService.calculateCartDelivery = async (items, subtotal, options) => {
        const base = 100 / 1.18;
        return {
            totalDeliveryCharge: base,
            totalDeliveryGST: 100 - base,
            totalDelivery: 100,
            items: [{
                product_id: 'GLOBAL',
                deliveryCharge: base,
                deliveryGST: 100 - base,
                snapshot: { source: 'global' }
            }]
        };
    };

    // Args: (items, address, coupon, userId)
    const result1 = await PricingCalculator.calculateCheckoutTotals(
        [...items], 'addr1', null, 'user1'
    );

    console.log(`Final: ${result1.final_amount} (Exp: 1493)`);
    console.log(`DelTotal: ${result1.delivery_total} (Exp: 100)`);

    if (Math.abs(result1.final_amount - 1493) < 1) console.log('PASS: Final Amount Correct');
    else console.error('FAIL: Final Amount Mismatch', result1.final_amount);


    // SCENARIO 2: Free Delivery Coupon
    console.log('\n--> SCENARIO 2: Free Delivery Coupon');

    // Mock Delivery for Scenario 2
    DeliveryChargeService.calculateCartDelivery = async (items, subtotal, { forceFreeStandard }) => {
        if (forceFreeStandard) {
            return {
                totalDeliveryCharge: 0,
                totalDeliveryGST: 0,
                totalDelivery: 0,
                items: [{
                    product_id: 'GLOBAL',
                    deliveryCharge: 0,
                    deliveryGST: 0,
                    snapshot: { source: 'global' }
                }]
            };
        }
        return { totalDelivery: 100 };
    };

    // Correct Arguments: items, address(null), coupon, userId
    const result2 = await PricingCalculator.calculateCheckoutTotals(
        [...items], null, 'FREEDELIVERY', 'user1'
    );

    console.log(`Final: ${result2.final_amount} (Exp: 1393)`);
    console.log(`DelTotal: ${result2.delivery_total} (Exp: 0)`);
    console.log(`CouponDisc: ${result2.coupon_discount} (Exp: 0 or 100?) -> We decided 0 if waived`);

    if (Math.abs(result2.final_amount - 1393) < 1) console.log('PASS: Final Amount Correct');
    else console.error('FAIL: Final Amount Mismatch', result2.final_amount);

    if (result2.delivery_total === 0) console.log('PASS: Delivery is 0');
    else console.error('FAIL: Delivery should be 0');


    // SCENARIO 3: Surcharge + Free Delivery
    console.log('\n--> SCENARIO 3: Surcharge + Free Delivery');

    // Mock Delivery for Scenario 3
    DeliveryChargeService.calculateCartDelivery = async (items, subtotal, { forceFreeStandard }) => {
        // Standard waived, Surcharge remains
        const surchargeTotal = 200;
        const surchargeBase = 200 / 1.18;
        return {
            totalDeliveryCharge: surchargeBase,
            totalDeliveryGST: surchargeTotal - surchargeBase,
            totalDelivery: surchargeTotal,
            items: [
                { source: 'global', deliveryCharge: 0, deliveryGST: 0 },
                { source: 'product', deliveryCharge: surchargeBase, deliveryGST: surchargeTotal - surchargeBase }
            ]
        };
    };

    const result3 = await PricingCalculator.calculateCheckoutTotals(
        [...items], null, 'FREEDELIVERY', 'user1'
    );

    console.log(`Final: ${result3.final_amount} (Exp: 1593)`); // 1393 + 200

    if (Math.abs(result3.final_amount - 1593) < 1) console.log('PASS: Final Amount Correct');
    else console.error('FAIL: Final Amount Mismatch', result3.final_amount);

    console.log('--- TESTS COMPLETED ---');
}

runTests().catch(console.error);
