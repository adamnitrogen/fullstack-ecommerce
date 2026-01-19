require('dotenv').config();
const checkoutService = require('../services/checkout.service');
const { createClient } = require('@supabase/supabase-js');

// Mock dependencies if needed, or rely on real DB/Services if safe
// We will try to run processPaymentAndOrder with a MOCK payment to avoid real Razorpay calls
// failing valid signatures.

// IMPORTANT: This script assumes we have a valid User ID from the DB
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runDebug() {
    console.log('Starting debug reproduction...');

    // 1. Get a valid user AND address
    const { data: addr, error } = await supabase
        .from('addresses')
        .select('id, user_id')
        .limit(1)
        .single();

    if (error || !addr) {
        console.error('No address/user found for testing');
        return;
    }

    console.log(`Using user: ${addr.user_id}`);
    console.log(`Using address: ${addr.id}`);

    // 2. We need a cart. Create a dummy cart item for this user if empty?
    // processPaymentAndOrder -> getUserCart
    // If cart is empty, validation might fail?
    // Let's assume user has a cart or create one.

    const { data: cart } = await supabase.from('carts').select('id').eq('user_id', addr.user_id).single();
    if (cart) {
        // Ensure items
        const { data: items } = await supabase.from('cart_items').select('id').eq('cart_id', cart.id);
        if (!items || items.length === 0) {
            console.log('Cart is empty, adding dummy item...');
            // Need a product
            const { data: product } = await supabase.from('products').select('id, price').limit(1).single();
            if (product) {
                await supabase.from('cart_items').insert({
                    cart_id: cart.id,
                    product_id: product.id,
                    quantity: 1
                });
            }
        }
    } else {
        // Create cart?
        console.log('No cart found, might fail...');
    }

    // 3. Mock payload
    const payload = {
        razorpay_order_id: 'mock_order_123_' + Date.now(),
        razorpay_payment_id: 'mock_pay_123_' + Date.now(),
        razorpay_signature: 'mock_sig',
        payment_id: null,
        shipping_address_id: addr.id,
        billing_address_id: addr.id,
        notes: 'Debug Test RPC'
    };

    try {
        await checkoutService.processPaymentAndOrder(addr.user_id, payload);
        console.log('Success! (RPC likely exists and works)');
    } catch (err) {
        console.error('Reproduction caught error:');
        console.error('Message:', err.message);
        // Check if it's the RPC signature error
        if (err.message.includes('create_order_transactional')) {
            console.error('>>> RPC FAILURE CONFIRMED <<<');
        }
        if (err.stack) console.error(err.stack);
    }
}

runDebug();
