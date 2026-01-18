require('dotenv').config({ path: './backend/.env' });
const supabase = require('./backend/config/supabase');

async function checkConfigs() {
    const { data, error } = await supabase
        .from('delivery_configs')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Configs:', data);
    }
}

checkConfigs();
