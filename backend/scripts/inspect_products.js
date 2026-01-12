const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabase = require('../config/supabase');

async function inspectTable() {
    try {
        console.log('Inspecting products table schema...');

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error selecting from products:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log('Columns found in products table:', Object.keys(data[0]));
        } else {
            console.log('Products table is empty, cannot infer columns from data.');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

inspectTable();
