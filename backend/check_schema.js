const supabase = require('./config/supabase');

async function checkSchema() {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('No events found, cannot determine columns from data.');
        }
    }
}

checkSchema();
