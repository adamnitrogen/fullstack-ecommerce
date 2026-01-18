const supabase = require('./config/supabase');

async function dumpPhoneSchema() {
    try {
        const { data, error } = await supabase
            .from('phone_numbers')
            .select('*')
            .limit(1);

        if (error) throw error;
        if (data.length > 0) {
            console.log('Phone Columns:', Object.keys(data[0]));
        } else {
            console.log('No phone numbers found');
        }
    } catch (err) {
        console.error('Failed to dump phone schema:', err);
    }
}

dumpPhoneSchema();
