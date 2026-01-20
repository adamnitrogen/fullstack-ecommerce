
require('dotenv').config({ path: '.env' });
const { supabase } = require('./config/supabase');

async function dumpPolicies() {
    console.log('--- Orders Table Policies ---');
    const { data: policies, error } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT * FROM pg_policies WHERE tablename = 'orders';"
    });

    if (error) {
        console.log('Error fetching policies via exec_sql (checking fallback):', error.message);
        // Fallback: search for migration files or use a known RPC
        const { data: rpcPolicies, error: rpcError } = await supabase.rpc('get_policies', { t_name: 'orders' });
        if (rpcError) {
            console.log('Fallback RPC failed too.');
        } else {
            console.log(JSON.stringify(rpcPolicies, null, 2));
        }
    } else {
        console.log(JSON.stringify(policies, null, 2));
    }
}

dumpPolicies();
