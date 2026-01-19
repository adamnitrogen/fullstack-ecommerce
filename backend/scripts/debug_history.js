require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkHistory() {
    console.log('Checking recent orders...');

    // Get last 5 orders
    const { data: orders, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, created_at, status, user_id')
        .order('created_at', { ascending: false })
        .limit(5);

    if (orderError) {
        console.error('Error fetching orders:', orderError);
        return;
    }

    console.log(`Found ${orders.length} orders.`);

    for (const order of orders) {
        console.log(`\nOrder ID: ${order.id}, Status: ${order.status}, Created: ${order.created_at}`);

        // Get history for this order
        const { data: history, error: historyError } = await supabaseAdmin
            .from('order_status_history')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at', { ascending: true });

        if (historyError) {
            console.error(`Error fetching history for order ${order.id}:`, historyError);
        } else {
            console.log(`  History entries: ${history.length}`);
            history.forEach(h => {
                console.log(`    - [${h.created_at}] Status: ${h.status}, Event: ${h.event_type}, Actor: ${h.actor}, UpdatedBy: ${h.updated_by}`);
            });
        }
    }
}

checkHistory();
