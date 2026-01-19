require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Standard client (simulating user if we had a token, but we'll use anon/service for now to inspect policies)
// Actually, to test RLS, we need a signed-in user.
// We can use the service role to Inspect the policies via SQL query if possible,
// or we can sign in a user and try to fetch.

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRLS() {
    // 1. Get the user ID from the debug order
    const userId = '9ed1e54b-1ca4-46fd-973d-5011b835d29a'; // from debugging output

    console.log('Testing access for user:', userId);

    // We can't easily mimic the user without their password to sign in.
    // However, we can impersonate using `auth.uid()` if we were running SQL.
    // simpler: Let's just look at the policy definition which we are doing via view_file.
    // But we can check if the table is enabled for RLS.

    // Check if RLS is enabled
    const { data, error } = await supabase
        .from('order_status_history')
        .select('*')
        .limit(1);

    // This uses service role, so it should bypass. 
    // If we simply use the ANON key, we can test "public" access (should be blocked)

}

// Instead of complex simulation, I will query pg_policies table
async function checkPolicies() {
    const { data, error } = await supabase
        .from('pg_policies')
        .select('tablename, policyname, roles, cmd, qual, permissive')
        .eq('tablename', 'order_status_history');

    if (error) {
        // pg_policies is a system catalog, might not be accessible via API directly unless publicized.
        // Usually it's not.
        console.log('Cannot query pg_policies directly via API:', error.message);
        return;
    }

    console.log('Active Policies:', data);
}

checkPolicies();
