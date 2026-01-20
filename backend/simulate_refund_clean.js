
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
        let globalChargeHandled = false;
        for (const group of itemGroups.values()) {
            const remaining = group.original_qty - group.returned_qty;
            if (remaining > 0) {
                // Simulation: Assume all items are global for this flat-rate check
                const isGlobal = true;

                if (isGlobal && globalChargeHandled) continue;

                const res = await MockDeliveryService.calculateDeliveryCharge(null, null, remaining);
                totalRemainingDelivery += res.totalDelivery;

                if (isGlobal) globalChargeHandled = true;
            }
        }

        const refund = totalOriginalDelivery - totalRemainingDelivery;
        return {
            original: totalOriginalDelivery,
            remaining: totalRemainingDelivery,
            refund: Math.round(refund * 100) / 100
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
    const res1 = await MockDeliveryService.calculateRefundDelivery(originalItems, [{ orderItemId: 'i1', quantity: 1 }]);
    console.log('Result 1:', res1);

    console.log('\nSCENARIO 2: Return Item 2 (The free one)');
    const res2 = await MockDeliveryService.calculateRefundDelivery(originalItems, [{ orderItemId: 'i2', quantity: 1 }]);
    console.log('Result 2:', res2);

    console.log('\nSCENARIO 3: Return Both');
    const res3 = await MockDeliveryService.calculateRefundDelivery(originalItems, [{ orderItemId: 'i1', quantity: 1 }, { orderItemId: 'i2', quantity: 1 }]);
    console.log('Result 3:', res3);

    console.log('\nSCENARIO 4: 3 Items (Flat Rate 50), Return 1');
    const items3 = [
        { id: 'a', quantity: 1, delivery_charge: 42.37, delivery_gst: 7.63 }, // Holds charge
        { id: 'b', quantity: 1, delivery_charge: 0, delivery_gst: 0 },
        { id: 'c', quantity: 1, delivery_charge: 0, delivery_gst: 0 }
    ];
    const res4 = await MockDeliveryService.calculateRefundDelivery(items3, [{ orderItemId: 'a', quantity: 1 }]);
    console.log('Result 4:', res4);
}

run();
