const axios = require('axios');
const readline = require('readline');

const BASE_URL = 'http://localhost:5000/api/auth'; // Adjust port if needed
const EMAIL = process.env.TEST_EMAIL || 'otp_test@example.com';
const PASSWORD = process.env.TEST_PASSWORD || 'password123';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function prompt(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function testOtpFlow() {
    try {
        console.log(`\nTesting OTP Flow for ${EMAIL}...\n`);

        // Step 1: Validate Credentials
        console.log('1. Call /validate-credentials...');
        try {
            const res1 = await axios.post(`${BASE_URL}/validate-credentials`, {
                email: EMAIL,
                password: PASSWORD
            });
            console.log('✅ Credentials Validated. Response:', res1.data);
        } catch (error) {
            console.error('❌ Failed /validate-credentials:', error.response?.data || error.message);
            process.exit(1);
        }

        // Step 2: Prompt for OTP
        const otp = await prompt('\n📧 Check your email/logs for OTP and enter it here: ');

        // Step 3: Verify OTP
        console.log('\n2. Call /verify-login-otp...');
        try {
            const res2 = await axios.post(`${BASE_URL}/verify-login-otp`, {
                email: EMAIL,
                otp: otp.trim()
            });
            console.log('✅ OTP Verified. Login Successful!');
            console.log('User:', res2.data.user);
            console.log('Cookies Set:', res2.headers['set-cookie']);
        } catch (error) {
            console.error('❌ Failed /verify-login-otp:', error.response?.data || error.message);
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    } finally {
        rl.close();
    }
}

testOtpFlow();
