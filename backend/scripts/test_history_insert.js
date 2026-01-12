const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabase = require('../config/supabase');

async function testInsert() {
    const { data: order } = await supabase.from('orders').select('id, user_id').limit(1).single();
    if (!order) return console.log('No order found');

    console.log(`Attempting insert for Order ${order.id}, User ${order.user_id}`);

    const { data, error } = await supabase
        .from('order_status_history')
        .insert({
            order_id: order.id,
            status: 'pending',
            updated_by: order.user_id,
            notes: 'Test insert',
            created_at: new Date().toISOString()
        })
        .select();

    if (error) {
        console.error('INSERT FAILED:', error);
    } else {
        console.log('INSERT SUCCESS:', data);
    }
}

testInsert();
