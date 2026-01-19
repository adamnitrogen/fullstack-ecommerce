const { RefundCalculator } = require('./services/refund-calculator.service');
const { DeliveryChargeService } = require('./services/delivery-charge.service');

// Mock specific helpers to avoid DB calls
DeliveryChargeService.getDeliveryConfig = async (pid, vid) => ({
    calculation_type: 'FLAT_PER_ORDER',
    base_delivery_charge: 50,
    gst_percentage: 18,
    is_taxable: true,
    delivery_refund_policy: 'REFUNDABLE'
});

DeliveryChargeService.calculateDeliveryCharge = async (pid, vid, qty) => {
    // Simplified simulation of calculateDeliveryCharge
    const charge = 50;
    const base = charge / 1.18;
    const gst = charge - base;
    return {
        deliveryCharge: base,
        deliveryGST: gst
    };
};

async function testRefund() {
    console.log('--- TEST START ---');

    // 1. Mock Order Item (Product)
    // Price: 1000 + 18% GST = 1180
    // Qty: 2
    const orderItem = {
        id: 'item_1',
        quantity: 2,
        taxable_amount: 1000 * 2,
        cgst: 90 * 2,
        sgst: 90 * 2,
        igst: 0,
        total_amount: 2360,
        delivery_charge: 42.37, // ~50 base split? No, let's say total delivery was 50 incl tax
        delivery_gst: 7.63
    };

    // 2. Test Refund Calculator (Returning 1 item)
    console.log('\n1. Product Refund (Returning 1 of 2):');
    const returnQty = 1;
    const productRefund = RefundCalculator.calculateItemRefund(orderItem, returnQty);
    console.log('Product Refund:', productRefund);

    // 3. Test Delivery Refund (Returning 1 of 2)
    // Scenario: Delivery was FLAT 50 for the order of 2 items.
    // Remaining order (1 item) still incurs FLAT 50.
    // So Refund SHOULD BE 0?
    // Let's check logic:
    // Original: 50
    // Remaining (calculate(1)): 50
    // Refund = Original - Remaining = 0. Correct for FLAT rate.

    console.log('\n2. Delivery Refund (Returning 1 of 2 - FLAT RATE):');
    const originalItems = [orderItem];
    const returnItems = [{ orderItemId: 'item_1', quantity: 1 }];

    const deliveryRefund = await DeliveryChargeService.calculateRefundDelivery(originalItems, returnItems);
    console.log('Delivery Refund:', deliveryRefund);

    // 4. Test Delivery Refund (Returning ALL 2 items)
    console.log('\n3. Delivery Refund (Returning 2 of 2 - FLAT RATE):');
    const returnItemsAll = [{ orderItemId: 'item_1', quantity: 2 }];
    // Remaining qty = 0 -> Calculate(0) ? wait logic checks remainingQuantity > 0
    // If remaining == 0, remainingDelivery = 0.
    // Refund = 50 - 0 = 50. CORRECT.

    const deliveryRefundAll = await DeliveryChargeService.calculateRefundDelivery(originalItems, returnItemsAll);
    console.log('Delivery Refund (Full):', deliveryRefundAll);

    console.log('--- TEST END ---');
}

testRefund();
