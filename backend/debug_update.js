
require('dotenv').config({ path: '.env' });
const { supabase } = require('./config/supabase');

async function testUpdate() {
    const orderId = 'ae90c213-cb83-498e-a465-7914ce06dab0'; // ORD202601200002
    const newStatus = 'shipped'; // Change to something else

    console.log(`\n=== Testing Direct Update for Order ID: ${orderId} ===`);

    // First, verify it exists
    const { data: before } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
    console.log('Current Status:', before?.status);

    const { data, error, count } = await supabase
        .from('orders')
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select();

    if (error) {
        console.error('Update Error:', error);
    } else {
        console.log('Update Success! Rows updated:', data?.length);
        console.log('Returned Data:', data);
    }
}

testUpdate();
