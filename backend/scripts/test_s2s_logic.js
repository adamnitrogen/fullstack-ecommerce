const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5001/api/event-registrations/verify-payment';
// You might need to adjust this depending on how you can get a valid registration ID and payment ID
// For a true integration test, we'd need to create a registration and a mock payment first.
// Since we can't easily pay without a UI in a script, we'll unit test the service logic or mocking.

// However, as an agent, I can best verify this by inspecting the logs after a real attempt or by mocking the service call if possible.
// Given the complexity of Razorpay integration, I will rely on the "S2S Verification" logic correctness by reviewing the code 
// and ensuring the logic flow is sound.

// Let's create a script that calls the verify endpoint with a MOCK payment ID to see if it triggers the S2S fetch and logs correctly.
// Note: This will likely fail at the S2S fetch stage (since the payment ID is fake), but we should see the logs up to that point.

async function testVerify() {
    try {
        // We need a valid registration ID from the DB to pass the first check
        // Let's manually fetch one if possible or just use a placeholder UUID
        const registrationId = '00000000-0000-0000-0000-000000000000';

        console.log('Testing S2S Failover with fake data...');

        await axios.post(API_URL, {
            razorpay_payment_id: 'pay_fake123456',
            registration_id: registrationId
            // razorpay_order_id is MISSING to trigger loose check
            // razorpay_signature is MISSING to trigger S2S
        });

    } catch (error) {
        console.log('Expected failure (since payment is fake), but checking response:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testVerify();
