const supabase = require('./config/supabase');

async function checkDb() {
    console.log('Checking database connection and schema...');
    try {
        const { data, error } = await supabase.from('roles').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Error accessing roles table:', error.message);
            if (error.message.includes('does not exist')) {
                console.log('\n❌ The "roles" table does not exist.');
                console.log('Please run the migration SQL in your Supabase Dashboard.');
            }
        } else {
            console.log('✅ "roles" table exists.');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkDb();
