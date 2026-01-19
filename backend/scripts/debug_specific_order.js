/**
 * Debug specific order history
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORDER_NUMBER = 'ORD202601190014'; // From screenshot

async function debugOrderHistory() {
    console.log('='.repeat(80));
    console.log(`DEBUGGING ORDER: ${ORDER_NUMBER}`);
    console.log('='.repeat(80));
    console.log('');

    // Get order details
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', ORDER_NUMBER)
        .single();

    if (orderError || !order) {
        console.error('❌ Order not found:', orderError?.message);
        process.exit(1);
    }

    console.log('📦 Order Information:');
    console.log(`   ID: ${order.id}`);
    console.log(`   Order Number: ${order.order_number}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment Status: ${order.payment_status}`);
    console.log(`   Created: ${order.created_at}`);
    console.log(`   Updated: ${order.updated_at}`);

    // Get history entries
    console.log('');
    console.log('📋 Order History Entries:');
    console.log('-'.repeat(80));

    const { data: history, error: histError } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

    if (histError) {
        console.error('❌ Error fetching history:', histError.message);
    } else if (!history || history.length === 0) {
        console.log('❌ NO HISTORY ENTRIES FOUND IN DATABASE');
    } else {
        console.log(`✅ Found ${history.length} history entries:\n`);
        history.forEach((entry, idx) => {
            console.log(`${idx + 1}. ${entry.event_type || entry.status}`);
            console.log(`   Status: ${entry.status}`);
            console.log(`   Actor: ${entry.actor}`);
            console.log(`   Notes: ${entry.notes}`);
            console.log(`   Created: ${entry.created_at}`);
            console.log(`   Updated By: ${entry.updated_by || 'N/A'}`);
            console.log('');
        });
    }

    // Check payment record
    console.log('💳 Payment Information:');
    console.log('-'.repeat(80));

    const { data: payment, error: payError } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', order.id)
        .single();

    if (payError) {
        console.log('❌ No payment record found:', payError.message);
    } else if (payment) {
        console.log(`   Payment ID: ${payment.id}`);
        console.log(`   Razorpay Payment ID: ${payment.razorpay_payment_id || 'N/A'}`);
        console.log(`   Razorpay Order ID: ${payment.razorpay_order_id || 'N/A'}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Method: ${payment.method || 'N/A'}`);
        console.log(`   Created: ${payment.created_at}`);
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('DIAGNOSIS');
    console.log('='.repeat(80));
    console.log('');

    if (!history || history.length === 0) {
        console.log('⚠️  CRITICAL: No history entries exist in database');
        console.log('');
        console.log('This means the RPC failed to log initial history during order creation.');
        console.log('');
        console.log('Possible causes:');
        console.log('1. RPC create_order_transactional has an error');
        console.log('2. History table has RLS blocking inserts');
        console.log('3. Foreign key constraint preventing insert');
    } else if (history.length === 1 && history[0].event_type === 'ORDER_PLACED') {
        console.log('⚠️  ISSUE: Only ORDER_PLACED event exists');
        console.log('');
        console.log('Missing events:');
        if (order.payment_status === 'paid') {
            console.log('  - PAYMENT_SUCCESS (should log after payment verification)');
        }
        if (order.status === 'confirmed') {
            console.log('  - ORDER_CONFIRMED (should log via webhook)');
        }
        console.log('');
        console.log('This suggests:');
        console.log('1. checkout.service.js PAYMENT_SUCCESS logging not executing');
        console.log('2. Webhook ORDER_CONFIRMED logging not executing');
        console.log('');
        console.log('Check backend logs for errors during order creation.');
    }

    console.log('');
}

debugOrderHistory().catch(console.error);
