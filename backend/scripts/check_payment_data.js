const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const supabase = require('../config/supabase');

async function checkPaymentData() {
    // Get the most recent order
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, payment_id, paymentStatus, status, createdAt')
        .order('createdAt', { ascending: false })
        .limit(3);

    if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        return;
    }

    console.log('Recent Orders:');
    for (const order of orders) {
        console.log(`\n--- Order: ${order.order_number || order.id} ---`);
        console.log('  Status:', order.status);
        console.log('  Payment Status:', order.paymentStatus);
        console.log('  payment_id (FK to payments):', order.payment_id || 'NULL');

        if (order.payment_id) {
            // Look up the payment
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .select('id, razorpay_payment_id, razorpay_order_id, method, status')
                .eq('id', order.payment_id)
                .single();

            if (paymentError) {
                console.log('  Payment Lookup Error:', paymentError.message);
            } else if (payment) {
                console.log('  ✓ Payment Found:');
                console.log('    razorpay_payment_id:', payment.razorpay_payment_id || 'NULL');
                console.log('    razorpay_order_id:', payment.razorpay_order_id);
                console.log('    method:', payment.method);
                console.log('    status:', payment.status);
            } else {
                console.log('  ✗ Payment NOT FOUND in payments table');
            }
        } else {
            console.log('  ✗ No payment_id linked to this order');
        }
    }
}

checkPaymentData().catch(console.error);
