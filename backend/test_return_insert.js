const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
    console.log('Attempting test insert into returns table as service role...');

    // Use a known order ID and user ID from the system if possible, or just dummy ones if constraints allow
    // From logs earlier: ORD202601180022 exists.
    // Order ID (UUID) for ORD202601180022? I don't know it yet.
    // Let's try to fetch an order ID first.

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, user_id')
        .limit(1)
        .single();

    if (orderError) {
        console.error('Error fetching order:', orderError);
        return;
    }

    console.log(`Using Order ID: ${order.id}, User ID: ${order.user_id}`);

    const { data, error } = await supabase
        .from('returns')
        .insert({
            order_id: order.id,
            user_id: order.user_id,
            status: 'requested',
            refund_amount: 100,
            reason: 'RLS TEST'
        })
        .select();

    if (error) {
        console.error('Insert Failed:', error);
    } else {
        console.log('Insert Succeeded:', data);
        // Clean up
        await supabase.from('returns').delete().eq('id', data[0].id);
        console.log('Test record cleaned up.');
    }
}

testInsert();
