
require('dotenv').config({ path: '.env' });
const { updateOrderStatus } = require('./services/order.service');

async function testUpdate() {
    const orderId = 'ae90c213-cb83-498e-a465-7914ce06dab0'; // ORD202601200002
    const newStatus = 'confirmed';
    const userId = '9ed1e54b-1ca4-46fd-973d-5011b835d29a'; // Admin user ID from history

    console.log(`\n=== Testing Status Update for Order ID: ${orderId} ===`);
    try {
        const result = await updateOrderStatus(orderId, newStatus, userId, 'Confirming for test', 'admin');
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Crash caught in script:', err);
    }
}

testUpdate();
