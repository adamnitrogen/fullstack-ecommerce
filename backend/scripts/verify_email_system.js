require('dotenv').config();
const { sendWelcomeEmail } = require('./services/email.service');
const supabase = require('./config/supabase');

async function testEmailSystem() {
    const testEmail = 'test-' + Date.now() + '@example.com';
    const testName = 'Test User';
    // Use a valid UUID if possible, or leave null for test
    const testUserId = null;

    console.log(`[TEST] Starting Email System Verification for ${testEmail}...`);

    try {
        // 1. Send Welcome Email
        console.log('[TEST] Sending Welcome Email...');
        const result = await sendWelcomeEmail(testEmail, testName, testUserId);

        console.log('[TEST] Email Function Result:', result);

        // 2. Verify Database Log
        console.log('[TEST] Verifying Database Log...');
        // Wait a moment for async logging if it wasn't awaited (but in our code it is awaited usually, except we didn't await the insert inside sendEmail fully? No, we awaited it).

        const { data: logs, error } = await supabase
            .from('email_notifications')
            .select('*')
            .eq('recipient_email', testEmail)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[TEST] Database Fetch Error:', error);
            return;
        }

        if (logs && logs.length > 0) {
            console.log('[TEST] ✅ Log Found:', logs[0]);
            console.log(`[TEST] Status: ${logs[0].status}`);
            console.log(`[TEST] Type: ${logs[0].email_type}`);
        } else {
            console.error('[TEST] ❌ No log entry found in email_notifications table.');
        }

    } catch (error) {
        console.error('[TEST] ❌ Verification Failed:', error);
    }
}

testEmailSystem();
