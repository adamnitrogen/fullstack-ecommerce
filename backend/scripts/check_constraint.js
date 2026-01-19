/**
 * Check the event_type constraint
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConstraint() {
    console.log('='.repeat(80));
    console.log('CHECKING event_type CONSTRAINT');
    console.log('='.repeat(80));
    console.log('');

    // Query to get constraint definition
    const query = `
        SELECT 
            con.conname AS constraint_name,
            pg_get_constraintdef(con.oid) AS constraint_definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'order_status_history'
        AND con.contype = 'c'
        AND con.conname LIKE '%event_type%';
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query })
        .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

    if (error || !data) {
        console.log('⚠️  Cannot query constraint via RPC');
        console.log('   Trying alternative method...');
        console.log('');

        // Alternative: Try inserting different values to find allowed ones
        const testValues = [
            'ORDER_PLACED',
            'ORDER_CONFIRMED',
            'ORDER_PACKED',
            'PAYMENT_SUCCESS',
            'STATUS_CHANGE'
        ];

        console.log('Testing which event_type values are allowed:');
        console.log('');

        const { data: order } = await supabase
            .from('orders')
            .select('id')
            .limit(1)
            .single();

        if (!order) {
            console.log('❌ No orders found to test with');
            return;
        }

        for (const eventType of testValues) {
            const { error: testError } = await supabase
                .from('order_status_history')
                .insert({
                    order_id: order.id,
                    status: 'pending',
                    event_type: eventType,
                    actor: 'SYSTEM',
                    notes: 'Test',
                    created_at: new Date().toISOString()
                });

            if (testError) {
                console.log(`   ❌ ${eventType} - NOT ALLOWED`);
                if (!testError.message.includes('check constraint')) {
                    console.log(`      Error: ${testError.message}`);
                }
            } else {
                console.log(`   ✅ ${eventType} - ALLOWED`);
                // Clean up
                await supabase
                    .from('order_status_history')
                    .delete()
                    .eq('event_type', eventType)
                    .eq('notes', 'Test');
            }
        }
    } else {
        console.log('Constraint definition:');
        console.log(data);
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('SOLUTION');
    console.log('='.repeat(80));
    console.log('');
    console.log('The event_type column has a CHECK constraint limiting allowed values.');
    console.log('');
    console.log('To fix this, you need to alter the constraint to include the new event types:');
    console.log('  - ORDER_CONFIRMED');
    console.log('  - ORDER_PROCESSING');
    console.log('  - ORDER_PACKED');
    console.log('  - ORDER_SHIPPED');
    console.log('  - OUT_FOR_DELIVERY');
    console.log('  - ORDER_DELIVERED');
    console.log('  - etc.');
    console.log('');
}

checkConstraint().catch(console.error);
