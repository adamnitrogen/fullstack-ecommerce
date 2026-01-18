const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = require('./config/supabase');

async function checkTable() {
    console.log('Checking invoices table...');
    const { data, error } = await supabase.from('invoices').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Error accessing invoices table:', error.message);
    } else {
        console.log('Invoices table accessible. Count:', data); // data is null for head:true usually, count is in count
    }

    console.log('Checking product GST columns...');
    const { data: pData, error: pError } = await supabase.from('products').select('is_gst_applicable, gst_rate, hsn_code').limit(1);

    if (pError) {
        console.error('Error accessing product GST columns:', pError.message);
    } else {
        console.log('Product GST columns accessible.');
    }
}

checkTable();
