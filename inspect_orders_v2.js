const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    const { data, error, count } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, user_id', { count: 'exact' })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Total Count:', count);
    console.log('Orders sample:');
    console.table(data);
}

inspect();
