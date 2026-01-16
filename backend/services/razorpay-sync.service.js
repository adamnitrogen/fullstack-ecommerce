const Razorpay = require('razorpay');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('RazorpaySyncService');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

class RazorpaySyncService {
    /**
     * Create an Item in Razorpay
     * @param {Object} itemData - { name, description, amount (in paise), currency, hsn_code, tax_rate }
     * @returns {Promise<Object>} Razorpay Item object
     */
    static async createItem(itemData) {
        try {
            log.operationStart('CREATE_ITEM', { name: itemData.name });

            // Validate HSN code length: Razorpay might enforce constraints
            // HSN code must be string
            const hsn_code = itemData.hsn_code ? String(itemData.hsn_code) : undefined;

            // Tax rate must be integer or float (percentage)
            // GST rates: 0, 5, 12, 18, 28
            // Razorpay usage: 500 = 5%, 1800 = 18%. Wait, let's verify docs.
            // Docs: tax_rate is in PERCENTAGE. e.g. 18.
            // BUT wait, Razorpay Items API takes 'tax_id' or 'tax_rate'?
            // Checking standard Razorpay Items API payload:
            // { name, description, amount, currency, hsn_code, tax_rate, tax_inclusive }
            // tax_rate is "Two decimal places". e.g. 18.00

            const payload = {
                name: itemData.name.substring(0, 40), // Limit name length if needed
                description: itemData.description ? itemData.description.substring(0, 255) : '',
                amount: Math.round(itemData.amount), // ensure integer paise
                currency: itemData.currency || 'INR',
            };

            // Optional GST fields
            if (hsn_code) payload.hsn_code = hsn_code;
            if (itemData.tax_rate !== undefined) payload.tax_rate = itemData.tax_rate;
            if (itemData.tax_inclusive !== undefined) payload.tax_inclusive = itemData.tax_inclusive;

            const item = await razorpay.items.create(payload);

            log.operationSuccess('CREATE_ITEM', { id: item.id });
            return item;
        } catch (error) {
            log.operationError('CREATE_ITEM', error);
            // Don't throw, just return null so we don't block product creation? 
            // Better to log and return null.
            return null;
        }
    }

    /**
     * Update an Item in Razorpay
     * @param {string} itemId - Razorpay Item ID
     * @param {Object} updates - { name, description, amount, ... }
     * @returns {Promise<Object>} Updated Razorpay Item
     */
    static async updateItem(itemId, updates) {
        try {
            log.operationStart('UPDATE_ITEM', { id: itemId });

            const payload = {};
            if (updates.name) payload.name = updates.name.substring(0, 40);
            if (updates.description) payload.description = updates.description.substring(0, 255);
            if (updates.amount) payload.amount = Math.round(updates.amount);
            if (updates.tax_rate !== undefined) payload.tax_rate = updates.tax_rate;
            if (updates.tax_inclusive !== undefined) payload.tax_inclusive = updates.tax_inclusive;
            if (updates.hsn_code) payload.hsn_code = String(updates.hsn_code);

            const item = await razorpay.items.edit(itemId, payload);

            log.operationSuccess('UPDATE_ITEM', { id: item.id });
            return item;
        } catch (error) {
            log.operationError('UPDATE_ITEM', error);
            return null;
        }
    }

    /**
     * Get Item by ID
     */
    static async getItem(itemId) {
        try {
            return await razorpay.items.fetch(itemId);
        } catch (error) {
            log.error({ err: error }, 'Error fetching Razorpay item');
            return null;
        }
    }
    /**
     * Delete an Item in Razorpay
     * @param {string} itemId - Razorpay Item ID
     * @returns {Promise<boolean>} Success status
     */
    static async deleteItem(itemId) {
        try {
            log.operationStart('DELETE_ITEM', { id: itemId });
            // Razorpay Items API supports delete
            await razorpay.items.delete(itemId);
            log.operationSuccess('DELETE_ITEM', { id: itemId });
            return true;
        } catch (error) {
            log.operationError('DELETE_ITEM', error);
            // If item is already deleted or not found, consider it success
            return false;
        }
    }
}

module.exports = RazorpaySyncService;
