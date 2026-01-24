const logger = require('../utils/logger');

/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;

    // Log the error using structured logger
    logger.error('Unhandled Exception', {
        module: 'API',
        operation: 'ERROR_HANDLER',
        err,
        req,
        statusCode
    });

    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : err.message,
        code: err.code || 'INTERNAL_ERROR',
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        correlationId: req.correlationId
    });
};

module.exports = errorHandler;
