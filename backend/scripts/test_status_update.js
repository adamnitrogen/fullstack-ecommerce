/**
 * Live Test: Directly update order status and watch history
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORDER_NUMBER = 'ORD202601190015';
const ADMIN_USER_ID = '9ed1e54b-1ca4-46fd-973d-5011b835d29a'; // From previous debug output

async function testStatusUpdate() {
    console.log('='.repeat(80));
    console.log('LIVE TEST: Status Update with History Logging');
    console.log('='.repeat(80));
    console.log('');

    // 1. Get order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, status')
        .eq('order_number', ORDER_NUMBER)
        .single();

    if (orderError || !order) {
        console.error('❌ Order not found');
        process.exit(1);
    }

    console.log(`📦 Order: ${order.order_number}`);
    console.log(`   Current Status: ${order.status}`);
    console.log('');

    // 2. Count history entries before
    const { data: beforeHistory, error: beforeError } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', order.id);

    const beforeCount = beforeHistory?.length || 0;
    console.log(`📊 History entries BEFORE: ${beforeCount}`);
    console.log('');

    // 3. Directly insert a test history entry
    console.log('🧪 Testing direct history insert...');

    const testEntry = {
        order_id: order.id,
        status: order.status,
        event_type: 'TEST_EVENT',
        actor: 'ADMIN',
        updated_by: ADMIN_USER_ID,
        notes: 'Direct insert test',
        created_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
        .from('order_status_history')
        .insert(testEntry)
        .select();

    if (insertError) {
        console.error('❌ Direct insert FAILED:', insertError.message);
        console.log('   Code:', insertError.code);
        console.log('   Details:', insertError.details);
        console.log('   Hint:', insertError.hint);
        console.log('');
        console.log('═'.repeat(80));
        console.log('ROOT CAUSE: Database Insert Failure');
        console.log('═'.repeat(80));
        console.log('');

        if (insertError.code === '23503') {
            console.log('Foreign key constraint violation!');
            console.log('Possible causes:');
            console.log('  - order_id foreign key constraint');
            console.log('  - updated_by foreign key constraint (user must exist)');
        } else if (insertError.code === '42501') {
            console.log('Permission denied!');
            console.log('RLS policy is blocking the insert.');
            console.log('');
            console.log('Solution: Disable RLS on order_status_history table OR');
            console.log('          Add policy to allow service role inserts');
        }
    } else {
        console.log('✅ Direct insert SUCCEEDED!');
        console.log('   Inserted ID:', insertData[0]?.id);
        console.log('');

        // Clean up test entry
        await supabase
            .from('order_status_history')
            .delete()
            .eq('event_type', 'TEST_EVENT')
            .eq('order_id', order.id);

        console.log('✅ Test entry cleaned up');
        console.log('');
        console.log('═'.repeat(80));
        console.log('DIAGNOSIS: Direct Insert Works!');
        console.log('═'.repeat(80));
        console.log('');
        console.log('This means the database allows inserts.');
        console.log('The issue must be in the logStatusHistory function itself.');
        console.log('');
        console.log('Next: Check if logStatusHistory is actually being called');
        console.log('      when admin updates status via the API.');
    }

    console.log('');
}

testStatusUpdate().catch(console.error);
