const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * @route POST /api/logs/client-error
 * @desc Receive and log frontend errors
 * @access Public
 */
router.post('/client-error', (req, res) => {
    const { message, stack, component, action, correlationId, traceId, spanId, ...rest } = req.body;

    logger.error(`Frontend Error: ${message}`, {
        module: component || 'Frontend',
        operation: action || 'CLIENT_ERROR',
        context: {
            ...rest,
            correlationId,
            traceId,
            spanId,
            stack
        }
    });

    res.status(204).send();
});

module.exports = router;
