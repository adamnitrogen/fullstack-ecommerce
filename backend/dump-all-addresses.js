const supabase = require('./config/supabase');

async function dumpAllAddresses() {
    try {
        const { data, error } = await supabase
            .from('addresses')
            .select('id, user_id, phone_number_id, label');

        if (error) throw error;
        console.log('All Addresses:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Failed to dump all addresses:', err);
    }
}

dumpAllAddresses();
