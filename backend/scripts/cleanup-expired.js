const { cleanupExpiredOTPs } = require('./services/otp.service');
const supabase = require('./config/supabase');

/**
 * Cleanup expired OTPs and refresh tokens
 */
async function runCleanup() {
    console.log('[Cleanup] Starting cleanup job...');

    try {
        // Clean expired OTPs
        await cleanupExpiredOTPs();
        console.log('[Cleanup] ✅ Expired OTPs cleaned');

        // Clean expired refresh tokens
        const { error } = await supabase
            .from('refresh_tokens')
            .delete()
            .lt('expires_at', new Date().toISOString());

        if (error) {
            console.error('[Cleanup] ❌ Refresh token cleanup error:', error);
        } else {
            console.log('[Cleanup] ✅ Expired refresh tokens cleaned');
        }

        console.log('[Cleanup] Cleanup job completed successfully');
    } catch (error) {
        console.error('[Cleanup] ❌ Cleanup job failed:', error);
    }
}

// Run cleanup
runCleanup()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
