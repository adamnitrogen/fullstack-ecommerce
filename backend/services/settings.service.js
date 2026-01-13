const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Settings Service
 * Handles fetching and managing store configuration from the database
 */

// Cache for settings to avoid redundant DB calls on every cart calculation
let settingsCache = {
    data: null,
    expiry: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function clearSettingsCache() {
    settingsCache = {
        data: null,
        expiry: 0
    };
}

async function getDeliverySettings() {
    try {
        const now = Date.now();
        if (settingsCache.data && now < settingsCache.expiry) {
            return settingsCache.data;
        }

        const { data, error } = await supabase
            .from('store_settings')
            .select('key, value')
            .in('key', ['delivery_threshold', 'delivery_charge']);

        if (error) throw error;

        const settings = data.reduce((acc, curr) => {
            acc[curr.key] = Number(curr.value);
            return acc;
        }, {});

        // Defaults if missing in DB
        const result = {
            delivery_threshold: settings.delivery_threshold ?? 1500,
            delivery_charge: settings.delivery_charge ?? 50
        };

        // Update cache
        settingsCache = {
            data: result,
            expiry: now + CACHE_DURATION
        };

        return result;
    } catch (error) {
        logger.error({ err: error }, 'Error fetching delivery settings:');
        return { delivery_threshold: 1500, delivery_charge: 50 }; // Fallback to hardcoded defaults
    }
}

async function updateDeliverySettings(settings) {
    try {
        const { threshold, charge } = settings;
        const updates = [];

        if (threshold !== undefined) {
            updates.push(
                supabase
                    .from('store_settings')
                    .update({ value: threshold.toString() })
                    .eq('key', 'delivery_threshold')
            );
        }

        if (charge !== undefined) {
            updates.push(
                supabase
                    .from('store_settings')
                    .update({ value: charge.toString() })
                    .eq('key', 'delivery_charge')
            );
        }

        const results = await Promise.all(updates);
        for (const res of results) {
            if (res.error) throw res.error;
        }

        clearSettingsCache();
        return await getDeliverySettings();
    } catch (error) {
        logger.error({ err: error }, 'Error updating delivery settings:');
        throw error;
    }
}

module.exports = {
    getDeliverySettings,
    clearSettingsCache,
    updateDeliverySettings
};
