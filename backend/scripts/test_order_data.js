/**
 * Comprehensive Test: Verify Order Data Persistence
 * 
 * Tests if order creation properly saves tax/delivery/snapshot data
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOrderDataPersistence() {
    console.log('='.repeat(80));
    console.log('ORDER DATA PERSISTENCE TEST');
    console.log('='.repeat(80));
    console.log('');

    // 1. Find most recent order
    console.log('📋 STEP 1: Fetching Recent Order');
    console.log('-'.repeat(80));

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
            id,
            order_number,
            status,
            created_at,
            items:order_items(*)
        `)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (orderError) {
        console.error('❌ Error fetching order:', orderError.message);
        process.exit(1);
    }

    if (!order) {
        console.log('⚠️  No orders found. Please create a test order first.');
        process.exit(0);
    }

    console.log('✅ Found Order:', order.order_number);
    console.log('   Status:', order.status);
    console.log('   Created:', new Date(order.created_at).toLocaleString());
    console.log('   Item Count:', order.items?.length || 0);

    // 2. Analyze order items data quality
    console.log('');
    console.log('📋 STEP 2: Analyzing Order Items Data');
    console.log('-'.repeat(80));

    if (!order.items || order.items.length === 0) {
        console.log('⚠️  No order items found');
        process.exit(0);
    }

    const item = order.items[0];

    console.log('Sample Order Item Analysis:');
    console.log('');

    // Check tax fields
    console.log('💰 Tax Data:');
    const taxFields = {
        'Taxable Amount': item.taxable_amount,
        'CGST': item.cgst,
        'SGST': item.sgst,
        'IGST': item.igst,
        'GST Rate': item.gst_rate,
        'HSN Code': item.hsn_code
    };

    Object.entries(taxFields).forEach(([label, value]) => {
        const status = (value === null || value === 0) ? '❌' : '✅';
        const display = value !== null ? value : 'NULL';
        console.log(`   ${status} ${label}: ${display}`);
    });

    // Check delivery fields
    console.log('');
    console.log('🚚 Delivery Data:');
    const deliveryFields = {
        'Delivery Charge': item.delivery_charge,
        'Delivery GST': item.delivery_gst,
        'Total Amount': item.total_amount
    };

    Object.entries(deliveryFields).forEach(([label, value]) => {
        const status = (value === null || value === 0) ? '❌' : '✅';
        const display = value !== null ? value : 'NULL';
        console.log(`   ${status} ${label}: ${display}`);
    });

    // Check snapshots
    console.log('');
    console.log('📸 Snapshot Data:');
    const snapshotFields = {
        'Variant Snapshot': item.variant_snapshot,
        'Delivery Calculation Snapshot': item.delivery_calculation_snapshot
    };

    Object.entries(snapshotFields).forEach(([label, value]) => {
        const status = value ? '✅' : '❌';
        const display = value ? 'Present' : 'NULL';
        console.log(`   ${status} ${label}: ${display}`);
    });

    // Check coupon fields
    console.log('');
    console.log('🎫 Coupon Data:');
    const couponFields = {
        'Coupon ID': item.coupon_id,
        'Coupon Code': item.coupon_code,
        'Coupon Discount': item.coupon_discount
    };

    Object.entries(couponFields).forEach(([label, value]) => {
        const status = value ? '✅' : '-';
        const display = value || 'None';
        console.log(`   ${status} ${label}: ${display}`);
    });

    // 3. Diagnose issues
    console.log('');
    console.log('📋 STEP 3: Diagnosis');
    console.log('-'.repeat(80));

    const issues = [];

    if (!item.cgst && !item.sgst && !item.igst) {
        issues.push('GST breakdown is missing (cgst, sgst, igst all NULL)');
    }

    if (!item.variant_snapshot) {
        issues.push('Variant snapshot is not being saved');
    }

    if (!item.delivery_calculation_snapshot) {
        issues.push('Delivery calculation snapshot is not being saved');
    }

    if (!item.hsn_code) {
        issues.push('HSN code is missing');
    }

    if (issues.length === 0) {
        console.log('✅ ALL DATA IS BEING SAVED CORRECTLY!');
        console.log('');
        console.log('The order system is working as expected.');
        console.log('Invoices should generate with correct data.');
    } else {
        console.log('⚠️  ISSUES DETECTED:');
        console.log('');
        issues.forEach((issue, idx) => {
            console.log(`   ${idx + 1}. ${issue}`);
        });
        console.log('');
        console.log('═'.repeat(80));
        console.log('ROOT CAUSE: RPC Function Not Updated');
        console.log('═'.repeat(80));
        console.log('');
        console.log('The database columns exist, but create_order_transactional RPC');
        console.log('is not populating them with data from checkout.');
        console.log('');
        console.log('FIX: Run the migration in Supabase SQL Editor');
        console.log('');
        console.log('Steps:');
        console.log('1. Go to: https://supabase.com/dashboard');
        console.log('2. SQL Editor → New Query');
        console.log('3. Copy/paste: backend/migrations/fix_order_items_schema_and_rpc.sql');
        console.log('4. Run');
        console.log('');
        console.log('This will update the RPC function to save all checkout data.');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
}

testOrderDataPersistence().catch(console.error);
