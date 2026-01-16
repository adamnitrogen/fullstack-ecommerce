const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { getContext } = require('./async-context');

const isProduction = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Create logs directory if it doesn't exist (for development)
const logsDir = path.join(__dirname, '..', 'logs');
if (!isProduction && !fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const { stdSerializers } = require('pino');

// Custom Serializers for strict sanitization
const reqSerializer = (req) => {
    if (!req) return req;
    const headers = req.headers || {};
    return {
        id: req.id,
        method: req.method,
        url: req.url,
        ip: req.remoteAddress,
        userAgent: headers['user-agent'],
        userId: (req.user && req.user.id) || headers['x-user-id'],
        // Explicitly exclude other headers to prevent leaking cookies/auth tokens
    };
};

const resSerializer = (res) => {
    if (!res) return res;
    return {
        statusCode: res.statusCode,
    };
};

// Constraint: Strict Size Limit (64KB for individual log lines)
const MAX_LOG_SIZE_BYTES = 64 * 1024;

/**
 * Defensive truncation function.
 * Returns a truncated string explanation if the object is too large.
 */
const safePayload = (obj) => {
    try {
        const str = JSON.stringify(obj);
        if (str && str.length > MAX_LOG_SIZE_BYTES) {
            return `[TRUNCATED - Payload size ${str.length} bytes exceeds limit of ${MAX_LOG_SIZE_BYTES} bytes]`;
        }
        return obj;
    } catch (e) {
        // If stringify fails (e.g. circular refs like req/res), return original object
        // and let Pino's configured serializers handle it.
        return obj;
    }
};

let logger;

// Mixin to add context (Correlation ID) to every log
const mixin = () => {
    return getContext() || {};
};

// Unified Log Structure Configuration
const baseLog = {
    layer: 'backend',
    environment: process.env.NODE_ENV || 'development',
};

// Helper: Restructure arguments to match schema
const restructureLog = (inputArgs) => {
    let [arg1, arg2, ...rest] = inputArgs;
    let logObj = {};
    let msg = arg2;

    // Handle case where first arg is message
    if (typeof arg1 === 'string') {
        msg = arg1;
        arg1 = {};
    } else if (typeof arg1 === 'object' && arg1 !== null) {
        logObj = { ...arg1 };
        // If msg was not provided as second arg, check if it's in the object
        if (!msg && logObj.msg) {
            msg = logObj.msg;
            delete logObj.msg;
        }
        if (!msg && logObj.message) {
            msg = logObj.message;
            delete logObj.message;
        }
    }

    // Extract mandatory and top-level fields
    const { module, operation, err, error, req, res, ...otherContext } = logObj;

    // Sanitize req/res if present
    const sanitizedContext = { ...otherContext };
    if (req) sanitizedContext.req = reqSerializer(req);
    if (res) sanitizedContext.res = resSerializer(res);

    // Construct final object
    const finalObj = {
        // Default to undefined to avoid cluttering if not provided? 
        // User requirements said "Mandatory Fields (...) Module: Derive from file".
        // If we can't derive, we use 'Unknown'.
        module: module || 'UnknownModule',
        operation: operation || 'UnknownOperation',
        context: safePayload(sanitizedContext)
    };

    // Normalize Error
    const startError = err || error;
    if (startError) {
        finalObj.error = stdSerializers.err(startError);
    }

    const outputArgs = [finalObj];
    if (msg) outputArgs.push(msg);

    return outputArgs;
};

if (isProduction) {
    // PRODUCTION: Use New Relic enricher for log correlation
    const newrelicPinoEnricher = require('@newrelic/pino-enricher');
    const nrEnricher = newrelicPinoEnricher();

    logger = pino(Object.assign({}, nrEnricher, {
        level: LOG_LEVEL,
        base: baseLog,
        // Override timestamp key to 'timestamp'
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        mixin,
        hooks: {
            logMethod(inputArgs, method, level) {
                const newArgs = restructureLog(inputArgs);
                return method.apply(this, newArgs);
            }
        },
        redact: {
            paths: [
                'password', 'token', 'accessToken', 'refreshToken', 'cookie', 'authorization', 'secret',
                'context.password', 'context.token', 'context.accessToken', 'context.refreshToken',
                'context.cookie', 'context.authorization', 'context.secret',
                'req.headers.cookie', 'req.headers.authorization',
                'context.req.headers.cookie', 'context.req.headers.authorization',
                '*.password', '*.token', '*.accessToken', '*.refreshToken', '*.cookie', '*.authorization', '*.secret'
            ],
            remove: true
        },
        formatters: {
            ...nrEnricher.formatters,
            level: (label) => {
                return { level: label.toUpperCase() };
            }
        }
    }));
} else {
    // DEVELOPMENT: Write to log file + pretty console output using multistream (main thread)
    const logFilePath = path.join(logsDir, 'app.log');

    // Stream 1: Pretty Console
    const prettyStream = require('pino-pretty')({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname,layer,environment,module,operation'
    });

    // Stream 2: File
    const fileStream = pino.destination({
        dest: logFilePath,
        sync: false, // Async writing for performance
        mkdir: true
    });

    // Combine streams
    const streams = [
        { stream: prettyStream },
        { stream: fileStream }
    ];

    logger = pino({
        level: LOG_LEVEL,
        base: baseLog,
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        mixin,
        hooks: {
            logMethod(inputArgs, method, level) {
                const newArgs = restructureLog(inputArgs);
                return method.apply(this, newArgs);
            }
        },
        redact: {
            paths: [
                'password', 'token', 'accessToken', 'refreshToken', 'cookie', 'authorization', 'secret',
                'email', 'phone', 'phoneNumber', 'mobile', 'creditCard', 'card',
                'gstin', 'pan',
                'context.password', 'context.token', 'context.accessToken', 'context.refreshToken',
                'context.cookie', 'context.authorization', 'context.secret',
                'context.gstin', 'context.pan',
                'req.headers.cookie', 'req.headers.authorization',
                'context.req.headers.cookie', 'context.req.headers.authorization',
                // Wildcards for deeply nested potential leaks
                '*.password', '*.token', '*.accessToken', '*.refreshToken', '*.cookie', '*.authorization', '*.secret',
                '*.email', '*.phone', '*.phoneNumber', '*.mobile', '*.creditCard', '*.card',
                '*.gstin', '*.pan'
            ],
            remove: true
        },
        formatters: {
            level: (label) => {
                return { level: label.toUpperCase() };
            }
        }
    }, pino.multistream(streams));

    // Log startup message
    logger.info({ module: 'Logger', operation: 'INIT' }, `Development logging to file: ${logFilePath}`);
}

module.exports = logger;
