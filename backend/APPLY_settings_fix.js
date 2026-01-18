require('dotenv').config();
const supabase = require('./config/supabase');

async function applyMigration() {
    console.log('Inserting delivery_gst setting...');
    const { error: insertError } = await supabase
        .from('store_settings')
        .upsert({
            key: 'delivery_gst',
            value: '0',
            description: 'Standard GST rate for delivery charges'
        }, { onConflict: 'key' });

    if (insertError) {
        console.error('Error inserting setting:', insertError);
    } else {
        console.log('Successfully initialized delivery_gst.');
    }

    // Since I can't easily run arbitrary SQL for RLS from the client without an RPC,
    // and the backend uses service role (bypassing RLS), 
    // the most critical part is ensuring the row exists so .update() / .upsert() works.

    // Check current settings
    const { data, error: fetchError } = await supabase
        .from('store_settings')
        .select('*');

    if (fetchError) {
        console.error('Error fetching settings:', fetchError);
    } else {
        console.log('Current settings:', data);
    }
}

applyMigration().then(() => process.exit());
