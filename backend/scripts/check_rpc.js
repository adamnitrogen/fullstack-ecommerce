require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRpc() {
    console.log('Checking create_order_transactional RPC...');

    // We can't easily query pg_proc via Supabase helper unless we use rpc('exec_sql') if enabled, or just try to call it and catch error.
    // However, we can use the `rpc` call with missing arguments to see the error message.

    try {
        // Call with NO arguments to trigger "argument missing" error which hopefully reveals expected signature
        const { error } = await supabase.rpc('create_order_transactional', {});
        if (error) {
            console.log('Error calling RPC (Expected):', error.message);
            console.log('Error Details:', JSON.stringify(error, null, 2));
        } else {
            console.log('RPC called successfully (Unexpected for empty args)');
        }
    } catch (e) {
        console.error('Exception:', e);
    }

    console.log('\nChecking order_status_history columns...');
    // Check if event_type column exists
    const { data: cols, error: colError } = await supabase
        .from('order_status_history')
        .select('event_type, actor')
        .limit(1);

    if (colError) {
        console.log('Error selecting new columns:', colError.message);
    } else {
        console.log('Columns likely exist. Sample data:', cols);
    }
}

checkRpc();
