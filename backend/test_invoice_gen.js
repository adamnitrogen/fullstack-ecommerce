
require('dotenv').config({ path: '.env' });
const { supabase } = require('./config/supabase');
const { InvoiceOrchestrator } = require('./services/invoice-orchestrator.service');

async function testInvoiceGen(orderNumber) {
    console.log(`\n=== Testing Invoice Generation for: ${orderNumber} ===`);

    const { data: order, error } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .single();

    if (error || !order) {
        console.error('Order not found:', error);
        return;
    }

    console.log('Found order ID:', order.id);

    try {
        const result = await InvoiceOrchestrator.generateInternalInvoice(order.id);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Execution Error:', err);
    }
}

const orderNum = process.argv[2] || 'ORD202601200001';
testInvoiceGen(orderNum);
