const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    const { data, error } = await supabase
        .from('orders')
        .select('order_number, customer_name, user_id')
        .ilike('order_number', 'ODR2026012200000%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.table(data);
}

inspect();
