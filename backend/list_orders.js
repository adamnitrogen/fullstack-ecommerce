const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function listLatestOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, status')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Latest Orders:');
    orders.forEach(o => console.log(`- ${o.order_number}: ${o.id} (${o.status})`));
}

listLatestOrders();
