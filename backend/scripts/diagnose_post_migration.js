/**
 * Check post-migration state for specific order
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORDER_NUMBER = 'ORD202601190016'; // From screenshot

async function diagnoseOrder() {
    console.log('='.repeat(80));
    console.log(`POST-MIGRATION DIAGNOSIS: ${ORDER_NUMBER}`);
    console.log('='.repeat(80));
    console.log('');

    // 1. Get order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', ORDER_NUMBER)
        .single();

    if (orderError || !order) {
        console.error('❌ Order not found:', orderError?.message);
        process.exit(1);
    }

    console.log('📦 Order Details:');
    console.log(`   ID: ${order.id}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment Status: ${order.payment_status}`);
    console.log(`   Created: ${order.created_at}`);
    console.log(`   Updated: ${order.updated_at}`);
    console.log('');

    // 2. Get history
    const { data: history, error: histError } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

    console.log('📋 History Entries:');
    console.log('-'.repeat(80));
    if (histError) {
        console.error('❌ Error:', histError.message);
    } else if (!history || history.length === 0) {
        console.log('❌ NO HISTORY ENTRIES!');
    } else {
        history.forEach((h, idx) => {
            console.log(`${idx + 1}. [${new Date(h.created_at).toLocaleTimeString()}] ${h.event_type}`);
            console.log(`   Status: ${h.status}, Actor: ${h.actor}`);
            console.log(`   Notes: ${h.notes}`);
            console.log('');
        });
    }

    // 3. Test constraint
    console.log('🧪 Testing Constraint:');
    console.log('-'.repeat(80));

    const testInsert = await supabase
        .from('order_status_history')
        .insert({
            order_id: order.id,
            status: order.status,
            event_type: 'ORDER_CONFIRMED',
            actor: 'SYSTEM',
            notes: 'Constraint test - will be deleted',
            created_at: new Date().toISOString()
        });

    if (testInsert.error) {
        console.log('❌ Constraint STILL BLOCKING:', testInsert.error.message);
        console.log('   Code:', testInsert.error.code);
        console.log('');
        console.log('🚨 MIGRATION DID NOT APPLY!');
        console.log('');
        console.log('Possible reasons:');
        console.log('1. Migration had a syntax error');
        console.log('2. Transaction was rolled back');
        console.log('3. Wrong database/schema');
    } else {
        console.log('✅ Constraint is working! New event types allowed.');

        // Clean up
        await supabase
            .from('order_status_history')
            .delete()
            .eq('notes', 'Constraint test - will be deleted');

        console.log('✅ Test entry cleaned up');
        console.log('');

        // So constraint works, but why no history?
        console.log('🔍 Root Cause Analysis:');
        console.log('-'.repeat(80));

        const hasPaymentSuccess = history?.some(h => h.event_type === 'PAYMENT_SUCCESS');
        const hasConfirmed = history?.some(h => h.event_type === 'ORDER_CONFIRMED');

        if (!hasPaymentSuccess && order.payment_status === 'paid') {
            console.log('❌ PAYMENT_SUCCESS event missing despite paid status');
            console.log('   → checkout.service.js logging not executing');
        }

        if (!hasConfirmed && order.status === 'confirmed') {
            console.log('❌ ORDER_CONFIRMED event missing despite confirmed status');
            console.log('   → Webhook logging not executing');
        }

        if (order.status !== 'pending' && history?.length === 1) {
            console.log('❌ Status updated but no history logged');
            console.log('   → order.service.js updateOrderStatus not logging');
            console.log('');
            console.log('Check backend logs for errors in logStatusHistory calls');
        }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('NEXT STEPS');
    console.log('='.repeat(80));
    console.log('');
    console.log('1. Check backend terminal for errors');
    console.log('2. Try updating order status via admin panel');
    console.log('3. Watch backend logs in real-time');
    console.log('4. Check if nodemon restarted after code changes');
    console.log('');
}

diagnoseOrder().catch(console.error);
