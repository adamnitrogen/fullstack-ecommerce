const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    const { data, error } = await supabase
        .from('orders')
        .select('order_number, customer_name')
        .ilike('order_number', 'ODR2026012200000%')
        .order('order_number', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.table(data);
}

inspect();
