const logger = require('../utils/logger');

/**
 * Global Error Handling Middleware
 * Captures unhandled errors, logs them with Correlation ID (if available),
 * and returns a standard JSON response to the client.
 */
const errorHandler = (err, req, res, next) => {
    // Check if headers have already been sent to avoid "Cannot set headers" error
    if (res.headersSent) {
        return next(err);
    }

    // Use request-scoped logger if available (contains Correlation ID), else fallback to global
    const log = req.log || logger;

    // Sanitize error object to prevent logging sensitive data (e.g. headers in axios errors)
    const safeError = {
        message: err.message,
        stack: err.stack,
        code: err.code,
        status: err.response?.status || err.status,
        // For axios errors, only log the response data if it's safe (e.g. validation errors), skip headers
        responseData: err.response?.data
    };

    // Log the error
    log.error({
        err: safeError,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id || req.headers['x-user-id']
    }, 'Unhandled Exception');

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Send response
    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : err.message,
        code: err.code || 'INTERNAL_ERROR',
        // Only include stack trace in development
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        // Include request ID for support reference
        requestId: req.id || req.headers['x-correlation-id']
    });
};

module.exports = errorHandler;
