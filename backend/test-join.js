const supabase = require('./config/supabase');

async function testJoin() {
    try {
        const { data, error } = await supabase
            .from('addresses')
            .select(`
                *,
                phone_numbers (
                    phone_number
                )
            `)
            .limit(5);

        if (error) throw error;

        data.forEach(addr => {
            console.log(`Address ID: ${addr.id}`);
            console.log(`Join Result:`, JSON.stringify(addr.phone_numbers, null, 2));
        });
    } catch (err) {
        console.error('Join failed:', err);
    }
}

testJoin();
