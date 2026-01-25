const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function inspect() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, user_id')
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Orders sample:');
    console.table(data);
}

inspect();
