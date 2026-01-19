/**
 * Debug Admin Status Updates for Specific Order
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORDER_NUMBER = 'ORD202601190015';

async function debugAdminStatusUpdates() {
    console.log('='.repeat(80));
    console.log(`DEBUGGING ADMIN STATUS UPDATES: ${ORDER_NUMBER}`);
    console.log('='.repeat(80));
    console.log('');

    // Get order
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
    console.log(`   Status: ${order.status}`);
    console.log(`   Created: ${order.created_at}`);
    console.log(`   Updated: ${order.updated_at}`);
    console.log('');

    // Get ALL history entries
    const { data: history, error: histError } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

    console.log('📋 Order History Timeline:');
    console.log('-'.repeat(80));

    if (histError) {
        console.error('❌ Error:', histError.message);
    } else if (!history || history.length === 0) {
        console.log('❌ NO HISTORY ENTRIES');
    } else {
        console.log(`Found ${history.length} history entries:\n`);

        history.forEach((entry, idx) => {
            const timestamp = new Date(entry.created_at).toLocaleString();
            console.log(`${idx + 1}. [${timestamp}] ${entry.event_type || entry.status}`);
            console.log(`   Status: ${entry.status}`);
            console.log(`   Actor: ${entry.actor}`);
            console.log(`   Notes: ${entry.notes}`);
            console.log('');
        });
    }

    // Check if there are any ADMIN actor entries
    const adminEntries = history?.filter(h => h.actor === 'ADMIN') || [];

    console.log('='.repeat(80));
    console.log('ANALYSIS');
    console.log('='.repeat(80));
    console.log('');

    if (adminEntries.length === 0) {
        console.log('⚠️  NO ADMIN STATUS UPDATES FOUND');
        console.log('');
        console.log('This means:');
        console.log('1. Admin has not updated the status yet, OR');
        console.log('2. Status updates are NOT being logged');
        console.log('');
        console.log('Expected flow when admin updates status:');
        console.log('1. Admin clicks status dropdown and selects new status');
        console.log('2. Frontend calls: PUT /api/orders/:id/status');
        console.log('3. Backend calls: order.service.js → updateOrderStatus()');
        console.log('4. updateOrderStatus() calls: logStatusHistory() with actor="ADMIN"');
        console.log('');
        console.log('If admin HAS updated status but no entries exist:');
        console.log('→ Check backend logs for errors');
        console.log('→ Verify logStatusHistory is being called');
        console.log('→ Check if history table RLS is blocking inserts');
    } else {
        console.log(`✅ Found ${adminEntries.length} admin status updates:`);
        adminEntries.forEach((entry, idx) => {
            console.log(`   ${idx + 1}. ${entry.event_type} - ${entry.notes}`);
        });
    }

    console.log('');
}

debugAdminStatusUpdates().catch(console.error);
