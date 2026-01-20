const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function listLatestReturns() {
    const { data: returns, error } = await supabase
        .from('returns')
        .select(`
            *,
            return_items (
                *
            )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Latest Return Requests:');
    returns.forEach(r => {
        console.log(`- ID: ${r.id}, Order ID: ${r.order_id}, Status: ${r.status}`);
        console.log(`  Refund Amount: ${r.refund_amount}`);
        console.log(`  Refund Breakdown:`, JSON.stringify(r.refund_breakdown, null, 2));
        console.log(`  Items:`);
        r.return_items.forEach(ri => {
            console.log(`    - Qty: ${ri.quantity}, Order Item ID: ${ri.order_item_id}`);
        });
        console.log('---');
    });
}

listLatestReturns();
