
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

async function testRawUpdate() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseRaw = createClient(supabaseUrl, supabaseServiceRoleKey);

    const orderId = 'ae90c213-cb83-498e-a465-7914ce06dab0'; // ORD202601200002
    const newStatus = 'shipped';

    console.log(`\n=== Testing Raw Update (No Proxy) ===`);
    try {
        const { data, error } = await supabaseRaw
            .from('orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .select()
            .single();

        if (error) {
            console.error('Raw Update Error:', error);
        } else {
            console.log('Raw Update Success! Status:', data.status);
        }
    } catch (err) {
        console.error('Raw Update Crash:', err);
    }
}

testRawUpdate();
