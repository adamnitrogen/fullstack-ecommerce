require('dotenv').config();
const { getCheckoutSummary, calculateCartTotals } = require('./services/checkout.service'); // Wait, calculateCartTotals is in cart.service
const cartService = require('./services/cart.service');
const checkoutService = require('./services/checkout.service');
const supabase = require('./config/supabase');

async function testSummary() {
    // 1. Find a user that HAS addresses
    const { data: userAddresses } = await supabase
        .from('addresses')
        .select('user_id')
        .limit(1);

    if (!userAddresses || userAddresses.length === 0) {
        console.log('No users with addresses found in DB');
        return;
    }
    const userId = userAddresses[0].user_id;
    console.log('Testing for User:', userId);

    // 2. Get an Address ID
    const { data: addresses } = await supabase.from('addresses').select('id').eq('user_id', userId).limit(1);
    const addressId = addresses?.[0]?.id;
    console.log('Using Address:', addressId);

    // 3. Call getCheckoutSummary WITHOUT Address
    console.log('\n--- Summary WITHOUT Address ---');
    const summaryNoAddr = await checkoutService.getCheckoutSummary(userId, null, null);
    console.log('Delivery:', summaryNoAddr.totals.deliveryCharge);
    console.log('Final Amount:', summaryNoAddr.totals.finalAmount);

    // 4. Call getCheckoutSummary WITH Address
    if (addressId) {
        console.log('\n--- Summary WITH Address ---');
        const summaryAddr = await checkoutService.getCheckoutSummary(userId, null, addressId);
        console.log('Delivery:', summaryAddr.totals.deliveryCharge); // Should be lower/0 if free delivery applies
        console.log('Final Amount:', summaryAddr.totals.finalAmount);
    } else {
        console.log('No address found for user, cannot test address specific case.');
    }
}

testSummary().catch(console.error);
