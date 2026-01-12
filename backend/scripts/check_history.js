const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabase = require('../config/supabase');

async function checkHistory() {
    // Get latest order
    const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, status')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single();

    if (!order) {
        console.log('No orders found');
        return;
    }

    console.log(`Checking history for Order: ${order.order_number} (${order.id})`);
    console.log(`Current Status: ${order.status}`);

    const { data: history, error } = await supabase
        .from('order_status_history')
        .select(`
            status, 
            notes, 
            created_at, 
            updated_by,
            updater:profiles!order_status_history_updated_by_profile_fk (
                first_name, 
                role_data:roles (name)
            )
        `)
        .eq('order_id', order.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching history:', error);
    } else {
        console.log('History Entries:', history.length);
        console.table(history.map(h => ({
            status: h.status,
            notes: h.notes,
            updater: h.updater?.first_name || 'System',
            role: h.updater?.role_data?.name || 'N/A'
        })));
    }
}

checkHistory();
