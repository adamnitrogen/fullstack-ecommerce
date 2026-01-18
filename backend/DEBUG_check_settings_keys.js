require('dotenv').config();
const supabase = require('./config/supabase');

async function checkSettings() {
    const { data, error } = await supabase.from('store_settings').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Settings:', data);
    }
}

checkSettings().then(() => process.exit());
