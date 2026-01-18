const supabase = require('./config/supabase');

async function dumpAddressSchema() {
    try {
        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .limit(1);

        if (error) throw error;
        if (data.length > 0) {
            console.log('Address Columns:', Object.keys(data[0]));
            console.log('Sample Address:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('No addresses found');
        }
    } catch (err) {
        console.error('Failed to dump address schema:', err);
    }
}

dumpAddressSchema();
