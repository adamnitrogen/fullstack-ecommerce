const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugOrderDelivery() {
    const ORDER_NUMBER = 'ORD202601190016';

    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            *,
            items:order_items(*)
        `)
        .eq('order_number', ORDER_NUMBER)
        .single();

    if (error || !order) {
        console.error('Error fetching order:', error);
        return;
    }

    console.log('--- ORDER LEVEL ---');
    console.log(`Order Number: ${order.order_number}`);
    console.log(`Order Delivery Charge: ${order.delivery_charge}`);
    console.log(`Order Delivery GST: ${order.delivery_gst}`);
    console.log(`Order Subtotal: ${order.subtotal}`);
    console.log(`Order Total: ${order.total_amount}`);

    console.log('\n--- ITEMS BREAKDOWN ---');
    order.items.forEach((item, idx) => {
        console.log(`\nItem ${idx + 1}: ${item.title}`);
        console.log(`  - Delivery Charge: ${item.delivery_charge}`);
        console.log(`  - Delivery GST: ${item.delivery_gst}`);
        console.log(`  - Refund Policy: ${item.delivery_calculation_snapshot?.delivery_refund_policy}`);
        console.log(`  - Snapshot Source: ${item.delivery_calculation_snapshot?.source}`);
        console.log(`  - Full Snapshot: ${JSON.stringify(item.delivery_calculation_snapshot, null, 2)}`);
    });
}

debugOrderDelivery();
