/**
 * Backfill Missing History Entries
 * 
 * This script adds missing PAYMENT_SUCCESS entries to orders that were
 * created before the code fix was applied.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillHistory() {
    console.log('='.repeat(80));
    console.log('BACKFILLING MISSING HISTORY ENTRIES');
    console.log('='.repeat(80));
    console.log('');

    // Find orders where payment_status = 'paid' but no PAYMENT_SUCCESS event exists
    console.log('🔍 Finding orders with missing PAYMENT_SUCCESS events...');
    console.log('');

    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, payment_status, created_at, user_id')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(10); // Last 10 orders

    if (ordersError) {
        console.error('❌ Error fetching orders:', ordersError.message);
        process.exit(1);
    }

    if (!orders || orders.length === 0) {
        console.log('ℹ️  No paid orders found');
        process.exit(0);
    }

    console.log(`Found ${orders.length} paid orders. Checking history...`);
    console.log('');

    let backfilled = 0;

    for (const order of orders) {
        // Check if PAYMENT_SUCCESS event already exists
        const { data: history, error: histError } = await supabase
            .from('order_status_history')
            .select('*')
            .eq('order_id', order.id)
            .eq('event_type', 'PAYMENT_SUCCESS')
            .limit(1);

        if (histError) {
            console.error(`❌ Error checking history for ${order.order_number}:`, histError.message);
            continue;
        }

        if (history && history.length > 0) {
            console.log(`✅ ${order.order_number}: Already has PAYMENT_SUCCESS event`);
            continue;
        }

        // Get payment details
        const { data: payment, error: payError } = await supabase
            .from('payments')
            .select('*')
            .eq('order_id', order.id)
            .single();

        if (payError || !payment) {
            console.log(`⚠️  ${order.order_number}: No payment record found, skipping`);
            continue;
        }

        // Insert PAYMENT_SUCCESS event
        const { error: insertError } = await supabase
            .from('order_status_history')
            .insert({
                order_id: order.id,
                status: order.status || 'pending',
                event_type: 'PAYMENT_SUCCESS',
                actor: 'SYSTEM',
                updated_by: order.user_id,
                notes: `Payment verified (ID: ${payment.razorpay_payment_id || payment.id})`,
                created_at: new Date(new Date(order.created_at).getTime() + 1000).toISOString() // 1 second after order creation
            });

        if (insertError) {
            console.error(`❌ ${order.order_number}: Failed to insert PAYMENT_SUCCESS:`, insertError.message);
        } else {
            console.log(`✅ ${order.order_number}: Added PAYMENT_SUCCESS event`);
            backfilled++;
        }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log(`BACKFILL COMPLETE: Added ${backfilled} history entries`);
    console.log('='.repeat(80));
}

backfillHistory().catch(console.error);
