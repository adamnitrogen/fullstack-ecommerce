require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPolicies() {
    console.log('Checking RLS Policies...');

    const { data, error } = await supabase
        .from('pg_policies')
        .select('tablename, policyname, cmd, qual, with_check')
        .in('tablename', ['orders', 'order_status_history', 'order_items']);

    if (error) {
        console.error('Error fetching policies:', error);
    } else {
        console.table(data);
        console.log('\nDetailed Policies:');
        data.forEach(p => {
            console.log(`\nTable: ${p.tablename}`);
            console.log(`Policy: ${p.policyname}`);
            console.log(`Command: ${p.cmd}`);
            console.log(`USING: ${p.qual}`);
            console.log(`WITH CHECK: ${p.with_check}`);
        });
    }
}

checkPolicies();
