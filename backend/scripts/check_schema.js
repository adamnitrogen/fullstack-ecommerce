
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log('Checking orders table schema...');

    // Check data
    const targetId = '210cce1e-5b4e-49c5-956c-fcf917dcfeb7';
    // ID from user logs
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, status, items, totalAmount')
        .eq('id', targetId)
        .single();

    if (orderError) {
        console.error('Error fetching order:', orderError);
        // Fallback to recent
        const { data: recent } = await supabase.from('orders').select('*').limit(1);
        console.log('Fallback recent:', recent);
    } else {
        console.log('Target Order Items:', JSON.stringify(orders.items, null, 2));
        console.log('Target Order Total:', orders.totalAmount);
    }

    // Check payments table
    console.log('Checking payments table schema...');
    const { data: paymentData, error: paymentError } = await supabase.from('payments').select('*').limit(1);

    if (paymentError) {
        console.error('Error fetching payments:', paymentError);
    } else if (paymentData && paymentData.length > 0) {
        console.log('Columns in payments table:', Object.keys(paymentData[0]));
        console.log('Sample Payment:', paymentData[0]);
    } else {
        console.log('Payments table empty or missing.');
    }
}

checkSchema();
