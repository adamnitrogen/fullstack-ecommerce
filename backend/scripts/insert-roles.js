const supabase = require('./config/supabase');

async function insertRoles() {
    console.log('Inserting default roles...');
    try {
        // Check if roles already exist
        const { data: existingRoles, error: checkError } = await supabase
            .from('roles')
            .select('name');

        if (checkError) {
            console.error('Error checking roles:', checkError);
            return;
        }

        const existingRoleNames = existingRoles?.map(r => r.name) || [];
        const rolesToInsert = ['admin', 'manager', 'customer'].filter(
            role => !existingRoleNames.includes(role)
        );

        if (rolesToInsert.length === 0) {
            console.log('✅ All roles already exist:', existingRoleNames);
            return;
        }

        // Insert missing roles
        const { data, error } = await supabase
            .from('roles')
            .insert(rolesToInsert.map(name => ({ name })))
            .select();

        if (error) {
            console.error('Error inserting roles:', error);
        } else {
            console.log('✅ Roles inserted successfully:', data);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

insertRoles();
