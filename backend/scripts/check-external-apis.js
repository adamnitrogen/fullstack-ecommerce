const axios = require('axios');

async function checkExternalApis() {
    console.log('Checking External APIs...');

    try {
        // 1. Countries API
        console.log('Checking Countries API (countriesnow.space)...');
        const countriesResponse = await axios.get('https://countriesnow.space/api/v0.1/countries');
        if (countriesResponse.data && !countriesResponse.data.error) {
            console.log('✅ Countries API is UP');
        } else {
            console.error('❌ Countries API returned error:', countriesResponse.data);
        }

        // 2. Zippopotam (Postal Code)
        console.log('Checking Zippopotam (US Postal Code)...');
        const zipResponse = await axios.get('https://api.zippopotam.us/us/90210');
        if (zipResponse.status === 200) {
            console.log('✅ Zippopotam API is UP');
        } else {
            console.error('❌ Zippopotam API returned status:', zipResponse.status);
        }

        // 3. GeoNames (Fallback) - requires username, skipping or using demo if possible
        // The code uses 'demo' username.
        console.log('Checking GeoNames (demo)...');
        try {
            const geoResponse = await axios.get('https://secure.geonames.org/postalCodeLookupJSON?postalcode=90210&country=US&username=demo');
            if (geoResponse.data) {
                console.log('✅ GeoNames API is UP');
            }
        } catch (e) {
            console.log('⚠️ GeoNames API check failed (might be rate limited or invalid demo user):', e.message);
        }

    } catch (error) {
        console.error('❌ External API Check Failed:', error.message);
    }
}

checkExternalApis();
