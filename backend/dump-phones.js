const supabase = require('./config/supabase');

async function dumpPhones() {
    try {
        const { data, error } = await supabase
            .from('phone_numbers')
            .select('*')
            .limit(10);

        if (error) throw error;
        console.log('Phone Numbers:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Failed to dump phones:', err);
    }
}

dumpPhones();
