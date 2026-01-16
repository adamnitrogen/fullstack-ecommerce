const { TaxEngine } = require('../services/tax-engine.service');

// Mock Data
const KARNATAKA_ADDRESS = { state: 'Karnataka', pincode: '560001', country: 'India' };
const MAHARASHTRA_ADDRESS = { state: 'Maharashtra', pincode: '400001', country: 'India' };

// Mock Items for calculateItemTax
// calculateItemTax expects flat object: { sellingPrice, gstRate, ... }
const SINGLE_ITEMS = {
    exclusive_18: {
        sellingPrice: 1000,
        quantity: 1,
        taxApplicable: true,
        gstRate: 18,
        priceIncludesTax: false
    },
    inclusive_12: {
        sellingPrice: 2000,
        quantity: 1,
        taxApplicable: true,
        gstRate: 12,
        priceIncludesTax: true
    },
    exempt: {
        sellingPrice: 500,
        quantity: 1,
        taxApplicable: false,
        gstRate: 0,
        priceIncludesTax: false
    }
};

function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ Assertion Failed: ${message}`);
    }
    console.log(`✅ ${message}`);
}

async function runVerification() {
    console.log('--- STARTING TAX ENGINE VERIFICATION ---\n');

    try {
        // SCENARIO 1: Inter-State (IGST) - Exclusive Tax
        console.log('SCENARIO 1: Inter-State (Different State) - Exclusive Tax');
        const tax1 = TaxEngine.calculateItemTax(SINGLE_ITEMS.exclusive_18, 'INTER');

        assert(tax1.taxableAmount === 1000, `Taxable Amount should be 1000 (Got ${tax1.taxableAmount})`);
        assert(tax1.igst === 180, `IGST should be 180 (Got ${tax1.igst})`);
        assert(tax1.cgst === 0, `CGST should be 0 (Got ${tax1.cgst})`);
        assert(tax1.totalAmount === 1180, `Total Amount should be 1180 (Got ${tax1.totalAmount})`);


        // SCENARIO 2: Intra-State (CGST + SGST) - Inclusive Tax
        console.log('\nSCENARIO 2: Intra-State (Same State) - Inclusive Tax');
        const tax2 = TaxEngine.calculateItemTax(SINGLE_ITEMS.inclusive_12, 'INTRA');

        const totalTax2 = tax2.cgst + tax2.sgst;
        assert(Math.abs(tax2.taxableAmount - 1785.71) < 0.1, `Taxable Amount check (Got ${tax2.taxableAmount})`);
        assert(Math.abs(totalTax2 - 214.28) < 0.1, `Total Tax check (Got ${totalTax2})`);
        assert(tax2.igst === 0, `IGST should be 0`);
        assert(tax2.totalAmount === 2000, `Total Amount should remain 2000 (Got ${tax2.totalAmount})`);


        // SCENARIO 3: Tax Exempt Item
        console.log('\nSCENARIO 3: Tax Exempt Item');
        const tax3 = TaxEngine.calculateItemTax(SINGLE_ITEMS.exempt, 'INTRA');

        assert(tax3.totalTax === 0, `Total Tax should be 0`);
        assert(tax3.totalAmount === 500, `Total Amount should be 500`);


        // SCENARIO 4: Order Totals (Mixed Cart)
        // calculateOrderTax expects items with a nested .variant structure
        console.log('\nSCENARIO 4: Full Order Calculation (Mixed Cart)');

        const cartItems = [
            {
                variant: {
                    selling_price: 1000,
                    tax_applicable: true,
                    gst_rate: 18,
                    price_includes_tax: false,
                    hsn_code: '1234'
                },
                quantity: 1
            },
            {
                variant: {
                    selling_price: 2000,
                    tax_applicable: true,
                    gst_rate: 12,
                    price_includes_tax: true,
                    hsn_code: '5678'
                },
                quantity: 2
            }
        ];

        // Address: Karnataka (Inter-state, Seller is 27-MH, Buyer is 29-KA)
        // Item 1: IGST 180
        // Item 2: IGST 428.57
        // Total Tax: ~608.57

        const orderSummary = TaxEngine.calculateOrderTax(cartItems, KARNATAKA_ADDRESS);
        console.log('Order Summary:', JSON.stringify(orderSummary.summary, null, 2));

        assert(orderSummary.summary.taxType === 'INTER', `Order Tax Type should be INTER (IGST)`);
        assert(orderSummary.summary.totalAmount === 5180, `Order Total should be 1180 + 4000 = 5180 (Got ${orderSummary.summary.totalAmount})`);
        assert(orderSummary.summary.totalIgst > 0, `Total IGST should be > 0`);

        console.log('\n--- VERIFICATION SUCCESSFUL ---');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
        process.exit(1);
    }
}

runVerification();
