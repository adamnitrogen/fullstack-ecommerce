const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectRLS() {
    console.log('Inspecting RLS for table: returns');

    // Check if RLS is enabled on the table
    const { data: tableInfo, error: tableError } = await supabase
        .rpc('get_table_info', { t_name: 'returns' }); // We might not have this RPC, let's try raw query via an existing one or just information_schema if we can.

    // Since we don't have get_table_info RPC, let's try to query pg_policies directly
    const { data: policies, error: policiesError } = await supabase
        .from('pg_policies') // This is a system view, usually not accessible via Standard RPC/Client unless exposed.
        .select('*');

    // NOTE: Standard Supabase Client cannot query system tables directly via .from().
    // We might need to use a custom RPC if available, or try to infer from migrations.

    console.log('Trying to query policies via RPC...');
    const { data: rpcPolicies, error: rpcError } = await supabase
        .rpc('exec_sql', { sql_query: 'SELECT * FROM pg_policies WHERE tablename = \'returns\'' });

    if (rpcError) {
        console.error('Error fetching policies via RPC:', rpcError);
    } else {
        console.log('Policies found:', JSON.stringify(rpcPolicies, null, 2));
    }

    // Also check table RLS status
    const { data: rpcRLS, error: rpcRLSError } = await supabase
        .rpc('exec_sql', { sql_query: 'SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace WHERE relname = \'returns\' AND nspname = \'public\'' });

    if (rpcRLSError) {
        console.error('Error checking RLS status:', rpcRLSError);
    } else {
        console.log('RLS Status:', JSON.stringify(rpcRLS, null, 2));
    }
}

inspectRLS();
