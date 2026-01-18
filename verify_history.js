
require('dotenv').config({ path: './backend/.env' });
const supabase = require('./backend/config/supabase');

async function checkHistory() {
    console.log('--- Checking Latest Order History ---');

    // 1. Get latest order
    const { data: latestOrder, error: orderError } = await supabase
        .from('orders')
        .select('id, created_at, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (orderError) {
        console.error('Error fetching latest order:', orderError);
        return;
    }

    if (!latestOrder) {
        console.log('No orders found.');
        return;
    }

    console.log(`Latest Order ID: ${latestOrder.id}`);
    console.log(`Status: ${latestOrder.status}`);
    console.log(`Created At: ${latestOrder.created_at}`);

    // 2. Fetch history directly
    const { data: history, error: historyError } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', latestOrder.id);

    if (historyError) {
        console.error('Error fetching history table:', historyError);
    } else {
        console.log(`Direct History Count: ${history.length}`);
        console.log('History Items:', JSON.stringify(history, null, 2));
    }

    // 3. Test the JOIN query used in order.service.js
    console.log('\n--- Testing JOIN Query ---');
    const { data: joinData, error: joinError } = await supabase
        .from('orders')
        .select(`
            id,
            order_status_history (
                status,
                event_type,
                actor,
                notes,
                created_at,
                updated_by
            )
        `)
        .eq('id', latestOrder.id)
        .single();

    if (joinError) {
        console.error('Error with JOIN query:', joinError);
    } else {
        const joinHistory = joinData.order_status_history || [];
        console.log(`Joined History Count: ${joinHistory.length}`);
        // console.log('Joined Items:', joinHistory);
    }
}

checkHistory();
