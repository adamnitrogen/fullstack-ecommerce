require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLS() {
    console.log('Fixing RLS policies to allow service role bypass...\n');

    const tables = ['order_status_history', 'refunds', 'invoices'];

    for (const table of tables) {
        console.log(`\n--- Processing table: ${table} ---`);

        // Disable RLS completely (removes FORCE)
        const { error: disableError } = await supabase.rpc('exec_sql', {
            sql_query: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`
        });

        if (disableError && disableError.code !== 'PGRST202') {
            console.error(`❌ Error disabling RLS on ${table}:`, disableError.message);
            console.log('Note: If RPC exec_sql is not available, you need to run this SQL manually in Supabase dashboard.');
            continue;
        }

        // Re-enable RLS (without FORCE, allowing service role bypass)
        const { error: enableError } = await supabase.rpc('exec_sql', {
            sql_query: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`
        });

        if (enableError && enableError.code !== 'PGRST202') {
            console.error(`❌ Error re-enabling RLS on ${table}:`, enableError.message);
            continue;
        }

        if (!disableError && !enableError) {
            console.log(`✅ Successfully updated RLS policy for ${table}`);
        }
    }

    console.log('\n\n=== MANUAL SQL (if RPC failed) ===');
    console.log('Run this in Supabase SQL Editor:\n');
    console.log(fs.readFileSync('migrations/fix_rls_service_role_bypass.sql', 'utf8'));
}

fixRLS().then(() => {
    console.log('\nDone!');
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
