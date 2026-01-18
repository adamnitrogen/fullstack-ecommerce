const supabase = require('./config/supabase');
const { getUserAddresses } = require('./services/address.service');

async function simulateRoute() {
    try {
        // Use the user ID from our previous dump
        const userId = '9ed1e54b-1ca4-46fd-973d-5011b835d29a';

        console.log(`Starting simulation for user: ${userId}`);

        const addresses = await getUserAddresses(userId);
        console.log(`Service returned ${addresses.length} addresses`);

        if (addresses.length > 0) {
            console.log('First Address Object:', JSON.stringify(addresses[0], null, 2));

            // Simulation of route transformation
            const transformedData = addresses.map(address => ({
                id: address.id,
                userId: address.user_id,
                type: address.type,
                isPrimary: address.is_primary,
                streetAddress: address.street_address,
                apartment: address.apartment,
                city: address.city,
                state: address.state,
                postalCode: address.postal_code,
                country: address.country,
                label: address.label,
                phone: address.phone,
                createdAt: address.created_at,
                updatedAt: address.updated_at
            }));

            console.log('Transformed Data (what backend sends):', JSON.stringify(transformedData[0], null, 2));
        }
    } catch (err) {
        console.error('Simulation failed:', err);
    }
}

simulateRoute();
