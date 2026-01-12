const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabase = require('../config/supabase');

const ORDER_ID = '1644b7f9-4c4f-4fc1-a399-7d7678340160';

async function checkOrder() {
    try {
        console.log(`Checking for order: ${ORDER_ID}`);

        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', ORDER_ID)
            .single();

        if (error) {
            console.error('Error fetching order:', error);
            return;
        }

        if (data) {
            console.log('Order FOUND:', {
                id: data.id,
                order_number: data.order_number,
                status: data.status,
                user_id: data.user_id
            });
        } else {
            console.log('Order NOT FOUND (Data is null)');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkOrder();
