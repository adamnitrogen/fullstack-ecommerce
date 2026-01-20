const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkZeroTaxItems() {
    const { data: items, error } = await supabase
        .from('order_items')
        .select('id, order_id, title, taxable_amount, cgst, sgst, igst, total_amount')
        .or('cgst.eq.0,sgst.eq.0,igst.eq.0')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Order Items with questionable tax:', items.length);
    items.forEach(item => {
        console.log(`- Item: ${item.title} (ID: ${item.id})`);
        console.log(`  Taxable: ${item.taxable_amount}, CGST: ${item.cgst}, SGST: ${item.sgst}, IGST: ${item.igst}`);
        console.log(`  Total: ${item.total_amount}`);
        console.log('---');
    });
}

checkZeroTaxItems();
