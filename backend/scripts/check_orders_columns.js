require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
    console.log('Checking orders table columns...');

    // Select a single row to see keys
    const { data, error } = await supabase.from('orders').select('*').limit(1);

    if (error) {
        console.error('Error fetching orders:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No orders found, but query worked. Cannot infer columns easily from empty data via JS client without inspection.');
        // Fallback: Check information_schema via RPC if possible, or just fail safe.
        // But invalid column names would break the Select *? No, Select * returns all valid columns.
    }
}

checkColumns();
