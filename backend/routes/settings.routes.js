const express = require('express');
const router = express.Router();
const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

/**
 * @route GET /api/settings/delivery
 * @desc Get dynamic delivery thresholds and charges
 * @access Public
 */
router.get('/delivery', async (req, res, next) => {
    try {
        const settings = await settingsService.getDeliverySettings();
        res.json(settings);
    } catch (error) {
        logger.error({ err: error }, 'Error in GET /settings/delivery');
        next(error);
    }
});

/**
 * @route PATCH /api/settings/delivery
 * @desc Update dynamic delivery thresholds and charges
 * @access Admin/Manager
 */
router.patch('/delivery', authenticateToken, authorizeRole('admin', 'manager'), async (req, res, next) => {
    try {
        const { threshold, charge } = req.body;
        const result = await settingsService.updateDeliverySettings({ threshold, charge });

        // Invalidate delivery settings cache in cart service
        const { invalidateDeliverySettingsCache } = require('../services/cart.service');
        invalidateDeliverySettingsCache();

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error in PATCH /settings/delivery');
        next(error);
    }
});

module.exports = router;
