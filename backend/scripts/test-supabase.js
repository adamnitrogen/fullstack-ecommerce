// Test Supabase Connection
const supabase = require('./config/supabase');

async function testConnection() {
    console.log('Testing Supabase connection...');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
    console.log('SUPABASE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_ANON_KEY);

    try {
        // Test a simple query
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);

        if (error) {
            console.error('Connection test failed:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                status: error.status
            });
        } else {
            console.log('✅ Connection successful!');
            console.log('Sample data:', data);
        }
    } catch (err) {
        console.error('❌ Connection test error:', err);
        console.error('Error type:', err.constructor.name);
        console.error('Error stringified:', JSON.stringify(err, null, 2));
    }
}

testConnection();
