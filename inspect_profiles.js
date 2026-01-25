const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .ilike('name', 'PLACEHOLDER');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Profiles with name PLACEHOLDER:');
    console.table(data);
}

inspect();
