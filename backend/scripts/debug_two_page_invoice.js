/**
 * Debug Two-Page Invoice Generation
 * Check if order has refundable delivery and why page 2 isn't generating
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugInvoiceGeneration() {
    console.log('='.repeat(80));
    console.log('TWO-PAGE INVOICE GENERATION DEBUG');
    console.log('='.repeat(80));
    console.log('');

    // Get most recent delivered order with invoice
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
            id,
            order_number,
            status,
            items:order_items(*)
        `)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (orderError || !order) {
        console.log('⚠️  No delivered orders found');
        console.log('   Create an order and mark it as delivered first');
        process.exit(0);
    }

    console.log(`📦 Analyzing Order: ${order.order_number}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Items: ${order.items?.length || 0}`);
    console.log('');

    if (!order.items || order.items.length === 0) {
        console.log('❌ No order items found');
        process.exit(0);
    }

    // Analyze each item for delivery refund policy
    console.log('📋 Item-by-Item Analysis:');
    console.log('-'.repeat(80));

    let hasRefundableDelivery = false;

    order.items.forEach((item, idx) => {
        console.log(`\n${idx + 1}. ${item.title}`);
        console.log(`   Quantity: ${item.quantity}`);
        console.log(`   Delivery Charge: ${item.delivery_charge || 0}`);
        console.log(`   Delivery GST: ${item.delivery_gst || 0}`);

        if (item.delivery_calculation_snapshot) {
            console.log(`   ✅ delivery_calculation_snapshot exists`);
            console.log(`      Policy: ${item.delivery_calculation_snapshot.delivery_refund_policy || 'N/A'}`);
            console.log(`      Type: ${item.delivery_calculation_snapshot.delivery_calculation_type || 'N/A'}`);

            if (item.delivery_calculation_snapshot.delivery_refund_policy === 'REFUNDABLE') {
                console.log(`   🎯 THIS ITEM HAS REFUNDABLE DELIVERY!`);
                hasRefundableDelivery = true;
            }
        } else {
            console.log(`   ❌ delivery_calculation_snapshot is NULL`);
        }
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('DIAGNOSIS');
    console.log('='.repeat(80));
    console.log('');

    if (!hasRefundableDelivery) {
        console.log('⚠️  NO REFUNDABLE DELIVERY FOUND');
        console.log('');
        console.log('Reasons why second page won\'t generate:');
        console.log('');
        console.log('1. delivery_calculation_snapshot is NULL');
        console.log('   → RPC not populating snapshot from checkout data');
        console.log('   → Migration fix_order_items_schema_and_rpc.sql may not be applied');
        console.log('');
        console.log('2. delivery_refund_policy is not "REFUNDABLE"');
        console.log('   → Delivery config might be set to NON_REFUNDABLE');
        console.log('   → Check delivery_configs table');
        console.log('');
        console.log('3. Item has no delivery_charge');
        console.log('   → Free delivery OR calculation error');
        console.log('');

        console.log('Code Logic (internal-invoice.service.js):');
        console.log('  const deliveryItems = orderItems.filter(item =>');
        console.log('    item.delivery_calculation_snapshot?.delivery_refund_policy === "REFUNDABLE"');
        console.log('  );');
        console.log('');
        console.log('  if (deliveryItems.length === 0) {');
        console.log('    // No second page generated!');
        console.log('  }');
    } else {
        console.log('✅ REFUNDABLE DELIVERY DETECTED!');
        console.log('');
        console.log('Second page SHOULD be generated.');
        console.log('');
        console.log('If it\'s not appearing, check:');
        console.log('1. PDF rendering logic in internal-invoice.service.js');
        console.log('2. Template rendering (gst-invoice.template.js)');
        console.log('3. Puppeteer PDF generation settings');
    }

    console.log('');
    console.log('📊 Recommendation:');
    console.log('');

    if (!order.items[0]?.delivery_calculation_snapshot) {
        console.log('Run migration: fix_order_items_schema_and_rpc.sql');
        console.log('Then create a NEW order (old orders won\'t have snapshot data)');
    } else {
        console.log('Check delivery_configs to ensure delivery is set to REFUNDABLE');
    }

    console.log('');
}

debugInvoiceGeneration().catch(console.error);
