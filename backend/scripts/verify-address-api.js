const axios = require('axios');
const supabase = require('../config/supabase');

const PORT = process.env.PORT || 5001;
const API_URL = `http://localhost:${PORT}/api`;

console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
console.log('Using PORT:', PORT);

async function runVerification() {
    console.log('Starting Address API Verification...');

    try {
        // 1. Get a user
        console.log('Fetching a test user...');
        const { data: users, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .limit(1);

        if (userError || !users || users.length === 0) {
            throw new Error('No users found in database to test with.');
        }

        const user = users[0];
        console.log(`Using user: ${user.email} (${user.id})`);

        // 2. Mock Headers
        const headers = {
            'Content-Type': 'application/json',
            'x-user-id': user.id // Some of our middleware might support this for testing
        };

        // 3. Get Addresses (Initial)
        console.log('\n[GET] /api/addresses');
        const initialResponse = await axios.get(`${API_URL}/addresses`, { headers });
        console.log(`Found ${initialResponse.data.length} addresses.`);

        // 4. Create Address
        console.log('\n[POST] /api/addresses');
        const newAddress = {
            type: 'other',
            streetAddress: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            postalCode: '123456',
            country: 'India',
            label: 'Test Label',
            isPrimary: false
        };

        const createResponse = await axios.post(`${API_URL}/addresses`, newAddress, { headers });
        const createdAddress = createResponse.data.address;
        console.log('Address created:', createdAddress.id);

        if (createdAddress.city !== 'Test City') throw new Error('City mismatch');

        // 5. Update Address
        console.log('\n[PUT] /api/addresses/:id');
        const updateData = {
            streetAddress: '456 Updated St',
            city: 'Updated City'
        };
        const updateResponse = await axios.put(`${API_URL}/addresses/${createdAddress.id}`, updateData, { headers });
        const updatedAddress = updateResponse.data.address;
        console.log('Address updated:', updatedAddress.id);

        if (updatedAddress.city !== 'Updated City') throw new Error('Update failed: City mismatch');
        if (updatedAddress.street_address !== '456 Updated St') throw new Error('Update failed: Street mismatch');

        // 6. Set Primary
        console.log('\n[POST] /api/addresses/:id/set-primary');
        const primaryResponse = await axios.post(`${API_URL}/addresses/${createdAddress.id}/set-primary`, {}, { headers });
        console.log('Address set as primary:', primaryResponse.data.address.is_primary);

        if (!primaryResponse.data.address.is_primary) throw new Error('Set primary failed');

        // 7. Delete Address
        console.log('\n[DELETE] /api/addresses/:id');
        await axios.delete(`${API_URL}/addresses/${createdAddress.id}`, { headers });
        console.log('Address deleted.');

        // Verify deletion
        try {
            await axios.put(`${API_URL}/addresses/${createdAddress.id}`, updateData, { headers });
            throw new Error('Address should have been deleted but was found');
        } catch (e) {
            if (e.response && e.response.status === 404) {
                console.log('Verification successful: Address not found after delete.');
            } else {
                throw e;
            }
        }

        console.log('\n✅ All Backend Verification Tests Passed!');

    } catch (error) {
        console.error('\n❌ Verification Failed:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received from server');
        } else {
            console.error('Error', error);
        }
        process.exit(1);
    }
}

runVerification();
