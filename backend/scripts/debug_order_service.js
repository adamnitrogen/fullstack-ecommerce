require('dotenv').config();
const { getOrderById } = require('../services/order.service');

async function debugOrder() {
    const orderId = 'dcc417c2-3ae6-4f0c-bf5e-c74003cab9bf'; // Latest order ID from previous debug
    const userId = '9ed1e54b-1ca4-46fd-973d-5011b835d29a'; // User ID from previous debug

    console.log(`Fetching order ${orderId} as user ${userId}...`);

    try {
        const order = await getOrderById(orderId, { id: userId, role: 'customer' });

        console.log('Order History Field:', JSON.stringify(order.order_status_history, null, 2));

        if (!order.order_status_history || order.order_status_history.length === 0) {
            console.error('ERROR: order_status_history is missing or empty!');
        } else {
            console.log('SUCCESS: History found.');
        }

    } catch (error) {
        console.error('Error fetching order:', error);
    }
}

debugOrder();
