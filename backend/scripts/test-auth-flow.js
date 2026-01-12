const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const API_URL = 'http://localhost:5001/api/auth';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Test credentials
const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'Test User';

async function runTest() {
    console.log('--- Starting Auth Flow Test ---');

    try {
        // 1. Register
        console.log(`\n1. Registering user: ${TEST_EMAIL}`);
        // We need to simulate the OTP flow or just create the user directly in DB?
        // The /register endpoint requires 'otpVerified: true'.
        // Let's create the user in Supabase Auth first, allowing us to bypass OTP for this test script if we were just testing DB, 
        // but to test the API properly we should probably use the real flow or a specific test helper.

        // Simpler: Just use /register with otpVerified: true (the backend endpoint trusts this flag? 
        // NO, the backend register endpoint just CHECKS this flag, it doesn't verify OTP itself? 
        // Let's check auth.routes.js... 
        // router.post('/register', ... const { otpVerified } = req.body; if (!otpVerified) return error; ...
        // It DOES NOT verify the OTP serverside again? 
        // Wait, "User is created ONLY after OTP verification". 
        // The API trusts the client saying "otpVerified: true"?
        // Looking at the code: 
        // if (!otpVerified) return res.status(400)...
        // Then it proceeds to create user. 
        // YES, it seems it trusts the flag. Ideally it should verify a signed token from the OTP step, but for now this makes testing easy.

        const registerRes = await axios.post(`${API_URL}/register`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            name: TEST_NAME,
            otpVerified: true
        });

        console.log('Register Success:', registerRes.status === 201);

        // Extract cookies
        let cookies = registerRes.headers['set-cookie'];
        console.log('Cookies received:', cookies ? cookies.length : 0);

        if (!cookies) throw new Error('No cookies received');

        const refreshTokenCookie = cookies.find(c => c.includes('refresh_token'));
        const accessTokenCookie = cookies.find(c => c.includes('access_token'));

        console.log('Has access_token:', !!accessTokenCookie);
        console.log('Has refresh_token:', !!refreshTokenCookie);

        // 2. Refresh
        console.log('\n2. Testing Refresh...');
        const refreshTokenValue = refreshTokenCookie.split(';')[0];
        console.log('Sending Cookie Header:', refreshTokenValue);

        const refreshRes = await axios.post(`${API_URL}/refresh`, {}, {
            headers: {
                Cookie: refreshTokenValue
            }
        });

        console.log('Refresh Response:', refreshRes.status, refreshRes.data);

        const newCookies = refreshRes.headers['set-cookie'];
        console.log('New cookies received:', newCookies ? newCookies.length : 0);

        // 3. Cleanup
        console.log('\n3. Cleaning up...');
        const userId = registerRes.data.user.id;
        await supabase.auth.admin.deleteUser(userId);
        console.log('User deleted.');

    } catch (error) {
        console.error('TEST FAILED:', error.response?.data || error.message);
    }
}

runTest();
