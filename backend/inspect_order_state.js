
require('dotenv').config({ path: '.env' });
const { supabase } = require('./config/supabase');
const logger = require('./utils/logger');

async function inspectOrder(orderNumber) {
    console.log(`\n=== Inspecting Order: ${orderNumber} ===`);

    // 1. Fetch Order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
            id, 
            order_number, 
            status, 
            payment_status, 
            invoice_url, 
            invoice_status,
            invoices (*)
        `)
        .eq('order_number', orderNumber)
        .single();

    if (orderError) {
        console.error('Error fetching order:', orderError);
        return;
    }

    console.log('Order Status:', order.status);
    console.log('Payment Status:', order.payment_status);
    console.log('Invoice URL in DB:', order.invoice_url);
    console.log('Invoice Status in DB:', order.invoice_status);
    console.log('Linked Invoices:', (order.invoices || []).map(i => `[${i.type}] ${i.public_url ? 'has-url' : 'no-url'} status:${i.status}`));

    // 2. Fetch History
    console.log('\n--- Status History ---');
    const { data: history, error: historyError } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

    if (historyError) {
        console.error('Error fetching history:', historyError);
    } else {
        history.forEach(h => {
            console.log(`[${h.created_at}] ${h.status} / ${h.event_type} - Actor: ${h.actor} - Notes: ${h.notes}`);
        });
    }
}

const orderNum = process.argv[2] || 'ORD202601200001';
inspectOrder(orderNum);
