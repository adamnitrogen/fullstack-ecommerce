require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificUser() {
    const userId = '9ed1e54b-1ca4-46fd-973d-5011b835d29a';
    console.log(`Checking profile for user: ${userId}`);
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Profile:', profile);
    }
}
checkSpecificUser();
