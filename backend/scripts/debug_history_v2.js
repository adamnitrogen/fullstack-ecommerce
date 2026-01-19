require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkHistoryAndProfiles() {
    console.log('Checking recent orders and potential profile mismatches...');

    // Check if the FK constraint exists
    const { data: constraints, error: constraintError } = await supabaseAdmin
        .rpc('get_constraints', { table_name_param: 'order_status_history' }); // This might not work if RPC doesn't exist.

    // Alternative: Query information_schema directly if possible (Supabase JS client doesn't support select on info schema easily without wrapper)
    // We will assume it might be there.

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
        console.log(`\nOrder ID: ${order.id}`);
        console.log(`  Created: ${order.created_at}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  User ID: ${order.user_id}`);

        // Check Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .eq('id', order.user_id)
            .single();

        if (profileError || !profile) {
            console.error(`  [CRITICAL] Profile NOT FOUND for User ID ${order.user_id}. This will fail FK constraints on history log!`);
        } else {
            console.log(`  Profile found: ${profile.email}`);
        }

        // Get history for this order
        const { data: history, error: historyError } = await supabaseAdmin
            .from('order_status_history')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at', { ascending: true });

        if (historyError) {
            console.error(`  Error fetching history:`, historyError);
        } else {
            console.log(`  History entries: ${history.length}`);
            if (history.length === 0) {
                console.warn(`  [WARNING] NO HISTORY FOUND for this order!`);
            }
            history.forEach(h => {
                console.log(`    - [${h.created_at}] ${h.status} (Actor: ${h.actor}, UpdatedBy: ${h.updated_by})`);
            });
        }
    }
}

checkHistoryAndProfiles();
