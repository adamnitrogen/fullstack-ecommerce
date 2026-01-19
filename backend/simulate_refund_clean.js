
// Mock Simulation of Refund Logic
// We copy the core logic here to verify it without needing the full backend environment

const CALCULATION_TYPES = {
    FLAT_PER_ORDER: 'FLAT_PER_ORDER',
    PER_PACKAGE: 'PER_PACKAGE',
    WEIGHT_BASED: 'WEIGHT_BASED',
    PER_ITEM: 'PER_ITEM'
};

// --- Mocking RefundCalculator ---
class RefundCalculator {
    static calculateItemRefund(orderItem, returnQuantity) {
        if (!orderItem || returnQuantity <= 0) {
            return { taxableRefund: 0, cgstRefund: 0, sgstRefund: 0, igstRefund: 0, totalRefund: 0 };
        }
        const quantity = orderItem.quantity;
        const refundRatio = returnQuantity / quantity;
        const proportional = (amount) => Number((amount * refundRatio).toFixed(2));

        const taxableRefund = proportional(orderItem.taxable_amount);
        const cgstRefund = proportional(orderItem.cgst);
        const sgstRefund = proportional(orderItem.sgst);
        const igstRefund = proportional(orderItem.igst);
        const totalRefund = Number((taxableRefund + cgstRefund + sgstRefund + igstRefund).toFixed(2));

        return { taxableRefund, cgstRefund, sgstRefund, igstRefund, totalRefund };
    }
}

// --- Mocking DeliveryChargeService Logic ---
// We replicate the 'calculateRefundDelivery' logic here to verify the ALGORITHM
class MockDeliveryService {

    // Mock Config
    static async getDeliveryConfig(pid) {
        return {
            calculation_type: 'FLAT_PER_ORDER',
            base_delivery_charge: 50,
            gst_percentage: 18,
            is_taxable: true,
            delivery_refund_policy: 'REFUNDABLE'
        };
    }

    // Mock Calculation
    static async calculateDeliveryCharge(pid, vid, qty) {
        // Flat rate 50 + GST
        const totalInclusive = 50;
        // Logic: 50 is base? No, usually generic config is base.
        // Let's assume 50 IS THE CHARGE. 
        // If taxable, and inclusive/exclusive... 
        // The service code says: "base = total / (1+rate)". 
        // But usually base_delivery_charge is the Base.
        // Wait, line 183 of service says "UNIVERSAL INCLUSIVE LOGIC".
        // "All configured delivery amounts... ARE the final totals"
        // So if config says 50, that's Total 50.

        const total = 50;
        const base = total / 1.18;
        const gst = total - base;

        return {
            deliveryCharge: base,
            deliveryGST: gst,
            totalDelivery: total
        };
    }

    static async calculateRefundDelivery(originalItems, returnedItems) {
        console.log('--- Simulating Delivery Refund ---');
        let totalOriginalDelivery = 0;
        let totalRemainingDelivery = 0;

        // Group items
        const itemGroups = new Map();
        for (const item of originalItems) {
            const key = item.id;
            itemGroups.set(key, { ...item, original_qty: item.quantity, returned_qty: 0 });
            totalOriginalDelivery += (item.delivery_charge + item.delivery_gst);
        }

        for (const ret of returnedItems) {
            if (itemGroups.has(ret.orderItemId)) {
                itemGroups.get(ret.orderItemId).returned_qty += ret.quantity;
            }
        }

        // Recalculate
        for (const group of itemGroups.values()) {
            const remaining = group.original_qty - group.returned_qty;
            if (remaining > 0) {
                // If Flat Rate, it applies ONCE per order usually? 
                // Wait, the Service logic groups by Product/Variant.
                // If FLAT_PER_ORDER, it applies once globally?
                // The service logic: 
                // "for (const [key, group] of itemGroups) ... calculateDeliveryCharge(remaining)"

                // CRITICAL OBSERVATION of Service Logic:
                // It iterates over GROUPS. 
                // If calculation_type is FLAT_PER_ORDER...
                // It calls `calculateDeliveryCharge` for EACH group with remaining quantity.
                // Inside `calculateDeliveryCharge`:
                // If FLAT_PER_ORDER -> returns base_charge (e.g. 50).

                // SO: If I have 2 items (Item A, Item B).
                // Original: Logic in calculateCartDelivery handles "Global Charge Applied Once".
                // But calculateRefundDelivery iterates groups and sums them up?
                // Does it handle the "Global Once" logic?

                // Looking at `calculateRefundDelivery` in service:
                // It iterates `itemGroups`.
                // It calls `calculateDeliveryCharge` for each group.
                // If `calculateDeliveryCharge` returns 50 for Item A, and 50 for Item B...
                // Then `totalRemainingDelivery` becomes 100.

                // ERROR POTENTIAL: If `calculateCartDelivery` smartly applied it ONCE (total 50).
                // But `calculateRefundDelivery` blindly sums re-calculations for each item...
                // It might think remaining delivery is 100 (50+50).
                // Original (50) - Remaining (100) = -50 refund?

                // Let's verify `calculateDeliveryCharge` behavior in the service.
                // It accepts `isFreeDelivery`.
                // It DOES NOT know about other items. 
                // So for Flat Rate, it returns 50.

                // Checks `calculateCartDelivery`:
                // It has `let globalChargeApplied = false`.
                // It applies it only to the first item.

                // Checks `calculateRefundDelivery`:
                // It iterates groups.
                // It seems to NOT have the "Global Once" check.
                // It sums `totalRemainingDelivery += result.deliveryCharge`.

                // THIS COULD BE A BUG if the implementation relies on `calculateDeliveryCharge` returning full flat rate per item.
                // HOWEVER, `originalItems` usually have the charge distributed?
                // `totalOriginalDelivery` loops original items and sums stored charges.
                // If Item A had 50 and Item B had 0 (because global-once), sum is 50.

                // If we return Item B (originally 0). Remaining is Item A (originally 50).
                // Re-calc Item A: 50.
                // Refund = 50 - 50 = 0. Correct.

                // If we return Item A (originally 50). Remaining is Item B (originally 0).
                // Re-calc Item B: 50 (because it's now the only item, or just re-evaluating).
                // Remaining Total = 50.
                // Refund = 50 - 50 = 0. Correct.

                // Wait, will `calculateRefundDelivery` call calc for Item B?
                // Yes, it iterates ALL groups.
                // So Item B group. Remaining = 1.
                // calls calculateDeliveryCharge(Item B). Returns 50.
                // So Remaining Total becomes 50.

                // Original Total = 50.
                // Refund = 50 - 50 = 0. Correct.

                // Scenario: Full Return.
                // Item A (50), Item B (0). Both returned.
                // Remaining A = 0. Remaining B = 0.
                // Total Remaining = 0.
                // Refund = 50 - 0 = 50. Correct.

                const res = await MockDeliveryService.calculateDeliveryCharge(null, null, remaining);
                totalRemainingDelivery += res.totalDelivery;
            }
        }

        const refund = totalOriginalDelivery - totalRemainingDelivery;
        return {
            original: totalOriginalDelivery,
            remaining: totalRemainingDelivery,
            refund: refund
        };
    }
}

async function run() {
    // Scenario: 2 items. Global Delivery 50.
    // Item 1: Qty 1. Charge 50.
    // Item 2: Qty 1. Charge 0.

    // Order Item 1
    const item1 = {
        id: 'i1',
        quantity: 1,
        delivery_charge: 42.37, delivery_gst: 7.63 // Total 50
    };
    // Order Item 2
    const item2 = {
        id: 'i2',
        quantity: 1,
        delivery_charge: 0, delivery_gst: 0 // Total 0
    };

    const originalItems = [item1, item2];

    console.log('SCENARIO 1: Return Item 1 (The one holding the charge)');
    // Remaining: Item 2.
    // Re-calc Item 2: Should be 50.
    // Original (50) - Remaining (50) = 0 Refund.
    const res1 = await MockDeliveryService.calculateRefundDelivery(originalItems, [{ orderItemId: 'i1', quantity: 1 }]);
    console.log('Result 1:', res1);

    console.log('\nSCENARIO 2: Return Item 2 (The free one)');
    // Remaining: Item 1.
    // Re-calc Item 1: Should be 50.
    // Original (50) - Remaining (50) = 0 Refund.
    const res2 = await MockDeliveryService.calculateRefundDelivery(originalItems, [{ orderItemId: 'i2', quantity: 1 }]);
    console.log('Result 2:', res2);

    console.log('\nSCENARIO 3: Return Both');
    // Remaining: 0.
    // Refund: 50.
    const res3 = await MockDeliveryService.calculateRefundDelivery(originalItems, [{ orderItemId: 'i1', quantity: 1 }, { orderItemId: 'i2', quantity: 1 }]);
    console.log('Result 3:', res3);

    console.log('\nSCENARIO 4: 3 Items (Flat Rate 50), Return 1');
    // Item 1, 2, 3.
    // Return Item 1. Remaining: Item 2, Item 3.
    // Recalc Delivery for Remaining (Item 2+3): Still 50 (Flat Rate).
    // Refund: 50 - 50 = 0.
    const items3 = [
        { id: 'a', quantity: 1, delivery_charge: 42.37, delivery_gst: 7.63 }, // Holds charge
        { id: 'b', quantity: 1, delivery_charge: 0, delivery_gst: 0 },
        { id: 'c', quantity: 1, delivery_charge: 0, delivery_gst: 0 }
    ];
    const res4 = await MockDeliveryService.calculateRefundDelivery(items3, [{ orderItemId: 'a', quantity: 1 }]);
    console.log('Result 4:', res4);
}

run();
