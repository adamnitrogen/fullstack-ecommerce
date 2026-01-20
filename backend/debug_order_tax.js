const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const orderId = '9eef0943-5746-4ef3-844b-9f2ee3975dfc';

async function debugOrder() {
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (orderError) {
        console.error('Error fetching order:', orderError);
    } else {
        console.log('Order found:', order.order_number, 'Status:', order.status);
    }

    const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

    if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        return;
    }

    console.log('Order Items count:', items.length);
    items.forEach(item => {
        console.log(`- Item: ${item.title}`);
        console.log(`  Price Per Unit: ${item.price_per_unit}`);
        console.log(`  Taxable Amount: ${item.taxable_amount}`);
        console.log(`  CGST: ${item.cgst}`);
        console.log(`  SGST: ${item.sgst}`);
        console.log(`  IGST: ${item.igst}`);
        console.log(`  Total Amount: ${item.total_amount}`);
        console.log('---');
    });
}

debugOrder();
