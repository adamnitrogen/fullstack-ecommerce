const supabase = require('./config/supabase');
const { getUserAddresses } = require('./services/address.service');

async function testFetch() {
    try {
        // Need a valid user ID. Let's find one from the addresses table.
        const { data: oneAddress, error: findError } = await supabase
            .from('addresses')
            .select('user_id')
            .limit(1)
            .single();

        if (findError || !oneAddress) {
            console.error('No addresses found to test with', findError);
            return;
        }

        const userId = oneAddress.user_id;
        console.log('Testing for user:', userId);

        const addresses = await getUserAddresses(userId);
        console.log('Fetched Addresses:', JSON.stringify(addresses, null, 2));

        // Also check raw DB join
        const { data: rawData, error: rawError } = await supabase
            .from('addresses')
            .select(`
                *,
                phone_numbers (
                    phone_number
                )
            `)
            .eq('user_id', userId);

        console.log('Raw DB Data:', JSON.stringify(rawData, null, 2));

    } catch (err) {
        console.error('Test failed:', err);
    }
}

testFetch();
