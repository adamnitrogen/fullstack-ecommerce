const supabase = require('./config/supabase');

async function checkDatabase() {
    try {
        // Check roles
        const { data: roles, error: roleError } = await supabase.from('roles').select('*');
        console.log('Roles:', roles);
        if (roleError) console.error('Role Error:', roleError);

        // Check profiles count
        const { count: profileCount, error: profileError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        console.log('Profile Count:', profileCount);
        if (profileError) console.error('Profile Error:', profileError);

        // Check manager_permissions count
        const { count: permCount, error: permError } = await supabase
            .from('manager_permissions')
            .select('*', { count: 'exact', head: true });
        console.log('Permission Count:', permCount);
        if (permError) console.error('Permission Error:', permError);

        // Check if table exists by inserting dummy (and failing) or just selecting
        const { data: samplePerms, error: sampleError } = await supabase
            .from('manager_permissions')
            .select('*')
            .limit(1);
        console.log('Sample Permission:', samplePerms);
        if (sampleError) console.error('Sample Permission Error:', sampleError);

    } catch (error) {
        console.error('Script Error:', error);
    }
}

checkDatabase();
