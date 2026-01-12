
const logger = require('../utils/logger');
const supabaseAdmin = require('./supabase');

/**
 * Bootstraps the Admin user based on environment variables.
 * Idempotent: Checks if admin exists before creating.
 */
async function bootstrapAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        logger.info('[Bootstrap] ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin bootstrap.');
        return;
    }

    logger.info('Verifying admin user configuration');

    try {
        // 1. Check if user exists by listing users (filtered by email if possible or just search)
        // Supabase Admin listUsers doesn't support filter by email directly in all versions, 
        // but we can search or just try to create and catch error, OR list and find.
        // Safer to list and find to avoid "User already exists" error noise if we just want to verify.

        // Actually, users usually fetched by ID. We can't easily "get user by email" with Admin API without listing?
        // Wait, createUser throws if email exists. That's a strong signal.
        // But we also want to ensure the EXISTING user has the admin role.

        // Strategy: List users and find the email.
        // Pagination might be an issue if we have millions, but for bootstrap it's usually early.
        // Better Strategy: Try to sign in? No, we don't want to use auth api for that.
        // Best Strategy for Admin: listUsers with query/filter if supported, or iterate.
        // Since it's critical, we'll try to find it.

        // NOTE: Supabase listUsers usually returns latest users.
        // Let's try `createUser` first. If it fails with "already registered", then we update it.

        let userId;

        // Try to verify if user exists implicitly by attempting to get it or just search?
        // Let's use listUsers which effectively allows managing users.
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) throw listError;

        const existingAdmin = listData.users.find(u => u.email === adminEmail);

        if (existingAdmin) {
            // logger.info('[Bootstrap] Admin user already exists.');
            userId = existingAdmin.id;

            // Check if role is correct
            const currentRole = existingAdmin.user_metadata?.role;
            if (currentRole !== 'admin') {
                logger.info('[Bootstrap] Updating existing user role to admin...');
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    userId,
                    { user_metadata: { ...existingAdmin.user_metadata, role: 'admin' } }
                );
                if (updateError) throw updateError;
                // logger.info('[Bootstrap] Admin role assigned.');
            } else {
                logger.info('[Bootstrap] Admin role verified.');
            }
        } else {
            logger.info('[Bootstrap] Creating new admin user...');
            const { data: newData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: adminEmail,
                password: adminPassword,
                email_confirm: true,
                user_metadata: { role: 'admin' }
            });

            if (createError) throw createError;
            userId = newData.user.id;
            logger.info('[Bootstrap] Admin user created successfully.');
        }

    } catch (error) {
        logger.error('[Bootstrap] Failed to bootstrap admin:', error.message);
        // We do not exit process, just log error, to allow server to start even if bootstrap fails (optional)
        // However, for security, maybe we should know. But standard practice is log and continue or retry.
    }
}

module.exports = { bootstrapAdmin };
