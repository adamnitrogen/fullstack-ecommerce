const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectRLS() {
    console.log('Inspecting RLS for table: returns using run_sql_query RPC');

    const { data, error } = await supabase
        .rpc('run_sql_query', {
            sql_query: `
                SELECT 
                    schemaname, 
                    tablename, 
                    policyname, 
                    permissive, 
                    roles, 
                    cmd, 
                    qual, 
                    with_check 
                FROM pg_policies 
                WHERE tablename = 'returns';
            `
        });

    if (error) {
        console.error('Error fetching policies:', error);
    } else {
        console.log('Policies found:', JSON.stringify(data, null, 2));
    }

    // Also check table RLS status
    const { data: rlsStatus, error: rlsError } = await supabase
        .rpc('run_sql_query', {
            sql_query: `
                SELECT 
                    relname, 
                    relrowsecurity,
                    relforcerowsecurity
                FROM pg_class 
                JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
                WHERE relname = 'returns' AND nspname = 'public';
            `
        });

    if (rlsError) {
        console.error('Error checking RLS status:', rlsError);
    } else {
        console.log('RLS Status:', JSON.stringify(rlsStatus, null, 2));
    }
}

inspectRLS();
