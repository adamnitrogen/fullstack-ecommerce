const supabase = require('../config/supabase');

async function checkRegistrations() {
    const { data, error } = await supabase
        .from('event_registrations')
        .select('id, invoice_url, registration_number, created_at, payment_status')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkRegistrations();
