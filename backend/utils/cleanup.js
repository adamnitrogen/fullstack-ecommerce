const supabase = require('../config/supabase');

/**
 * Clean up orphaned Supabase Auth users
 * (users who exist in Auth but not in profiles table)
 */
async function cleanupOrphanedUser(email) {
    try {
        console.log(`🔍 Checking for orphaned user: ${email}`);

        // Check if user exists in profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (profile) {
            console.log(`✅ User has profile, no cleanup needed`);
            return { cleaned: false, reason: 'User has profile' };
        }

        // User doesn't have profile, check if they exist in Auth
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const authUser = users.find(u => u.email === email);

        if (!authUser) {
            console.log(`✅ No orphaned user found in Auth`);
            return { cleaned: false, reason: 'No auth user found' };
        }

        // Found orphaned user, delete them
        console.log(`🗑️  Deleting orphaned auth user: ${authUser.id}`);

        const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);

        if (deleteError) {
            console.error('❌ Failed to delete orphaned user:', deleteError);
            throw deleteError;
        }

        console.log(`✅ Successfully deleted orphaned user: ${authUser.id}`);

        // Wait for deletion to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));

        return { cleaned: true, userId: authUser.id };
    } catch (error) {
        console.error('Cleanup error:', error);
        throw error;
    }
}

module.exports = {
    cleanupOrphanedUser
};
