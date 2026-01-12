const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const axios = require('axios');

/**
 * GET /api/geo/countries
 * Proxy for countries API
 */
router.get('/countries', async (req, res) => {
    try {
        const response = await axios.get('https://countriesnow.space/api/v0.1/countries');
        res.json(response.data);
    } catch (error) {
        logger.error({ err: error.message }, 'Error fetching countries:');
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

/**
 * POST /api/geo/states
 * Proxy for states API
 */
router.post('/states', async (req, res) => {
    try {
        const { country } = req.body;
        const response = await axios.post('https://countriesnow.space/api/v0.1/countries/states', {
            country
        });
        res.json(response.data);
    } catch (error) {
        logger.error({ err: error.message }, 'Error fetching states:');
        res.status(500).json({ error: 'Failed to fetch states' });
    }
});

/**
 * GET /api/geo/postal/:country/:postalCode
 * Proxy for postal code validation
 */
router.get('/postal/:country/:postalCode', async (req, res) => {
    try {
        const { country, postalCode } = req.params;
        let isValid = false;

        // Try Zippopotam first
        try {
            const response = await axios.get(`https://api.zippopotam.us/${country}/${postalCode}`);
            if (response.data && response.data.places && response.data.places.length > 0) {
                isValid = true;
                return res.json({ valid: true, data: response.data });
            }
        } catch (e) {
            // Continue to next API
        }

        // Try GeoNames as fallback
        try {
            const response = await axios.get(`https://secure.geonames.org/postalCodeLookupJSON`, {
                params: {
                    postalcode: postalCode,
                    country: country,
                    username: 'demo'
                }
            });
            if (response.data && response.data.postalcodes && response.data.postalcodes.length > 0) {
                isValid = true;
                return res.json({ valid: true, data: response.data });
            }
        } catch (e) {
            // Continue
        }

        // Try India Post for India
        if (country === 'IN') {
            try {
                const response = await axios.get(`https://api.postalpincode.in/pincode/${postalCode}`);
                if (response.data && response.data[0].Status === 'Success' && response.data[0].PostOffice.length > 0) {
                    isValid = true;
                    return res.json({ valid: true, data: response.data });
                }
            } catch (e) {
                // All failed
            }
        }

        res.json({ valid: false });
    } catch (error) {
        logger.error({ err: error.message }, 'Error validating postal code:');
        res.status(500).json({ error: 'Failed to validate postal code' });
    }
});

module.exports = router;
