require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProfiles() {
    console.log('Checking profiles table columns...');
    const { data, error } = await supabase.from('profiles').select('*').limit(1);

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
        console.log('Sample Row:', data[0]);
    } else {
        console.log('No profiles found or error:', error);
    }
}
checkProfiles();
