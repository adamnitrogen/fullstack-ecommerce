const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * POST /api/logs/client
 * Ingest logs from the frontend
 */
router.post('/client', (req, res) => {
    // Destructure known fields from the unified schema
    const {
        level = 'info',
        message,
        module,
        operation,
        context,
        error,
        timestamp,
        layer,
        environment,
        ...rest
    } = req.body;

    const correlationId = req.headers['x-correlation-id'];

    // Construct the object for the backend logger
    // The backend logger's hook will process this
    const logData = {
        // Enforce frontend identity if not present, though frontend sends it
        layer: layer || 'frontend',
        module: module || 'FrontendClient',
        operation: operation || 'Log',
        // Preserve client context
        context: {
            ...context,
            clientTimestamp: timestamp,
            correlationId,
            environment // Client environment might differ slightly (e.g. browser details)
        },
        error,
        ...rest // Any other top-level fields
    };

    // Normalize level
    const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
    const safeLevel = validLevels.includes(level.toLowerCase()) ? level.toLowerCase() : 'info';

    // Log it
    if (logger[safeLevel]) {
        logger[safeLevel](logData, message);
    } else {
        logger.info(logData, message);
    }

    res.status(200).json({ received: true });
});

module.exports = router;
