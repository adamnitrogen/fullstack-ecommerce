require('dotenv').config({ path: '../.env' });
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// Force logger to output to console for visibility if needed, 
// but local dev usually logs to file or console anyway.

async function runTest() {
    console.log('--- Starting Logging Verification ---');

    try {
        // 1. Test Simple Select
        console.log('1. Testing SELECT (should log)...');
        const { data: contact, error } = await supabase
            .from('contact_info')
            .select('email, phone')
            .limit(1);

        console.log('Select Result:', contact ? 'Success' : 'Error');

        // 2. Test Sensitive Data Handling (Mock Insert)
        // We won't actually insert to avoid garbage, but we can verify redaction 
        // by attempting an RPC or finding a way to log a "param".
        // Or simply checking if the logger redacts the returned data IF we logged it (but we log row count, not data).
        // The logger proxy logs `params` for RPC.

        console.log('2. Testing RPC with sensitive params (should mask)...');
        // We probably don't have a real RPC that takes these params, 
        // but the proxy doesn't validate existence before logging the attempt (if successful) or error.
        // Actually, if it errors, it logs error.

        try {
            await supabase.rpc('test_sensitive_func', {
                email: 'test@example.com',
                password: 'secret_password',
                phone: '1234567890'
            });
        } catch (e) {
            console.log('RPC intentionally failed (expected), checking logs for redaction.');
        }

    } catch (err) {
        console.error('Test failed:', err);
    }

    console.log('--- Verification Finished. Check app.log ---');
}

runTest();
