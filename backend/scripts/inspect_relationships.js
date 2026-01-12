const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabase = require('../config/supabase');

async function inspectConstraints() {
    try {
        console.log('Fetching constraints for orders and payments tables...');

        // This query works on Postgres to find FKs
        // But via Supabase JS client, we can't run raw SQL easily unless we have a function.
        // We will try to infer from data or use a known RPC if available. 
        // Lacking that, we can try to guess or use the `!fk_column` syntax which PostgREST supports.

        // PostgREST disambiguation often works by specifying the column name of the FK.
        // If orders has payment_id, we can try `payment:payments!payment_id`? 
        // Or if payments has order_id, `payment:payments!order_id`?

        // Let's just try to select one order and see its structure to confirm column names
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .limit(1)
            .single();

        if (order) {
            console.log('Order keys:', Object.keys(order));
            console.log('Has payment_id?', !!order.payment_id);
        }

        const { data: payment, error: pError } = await supabase
            .from('payments')
            .select('*')
            .limit(1)
            .single();

        if (payment) {
            console.log('Payment keys:', Object.keys(payment));
            console.log('Has order_id?', !!payment.order_id);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

inspectConstraints();
