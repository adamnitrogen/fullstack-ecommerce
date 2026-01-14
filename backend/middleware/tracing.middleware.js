/**
 * Tracing Middleware
 * 
 * Implements distributed tracing with:
 * - Trace ID: Unique ID for entire request journey (UI → Backend → DB)
 * - Span ID: Unique ID for each operation/hop within a trace
 * - Correlation ID: User-facing request ID (same as trace ID or client-provided)
 * 
 * Headers:
 * - X-Trace-ID: Trace identifier (extracted or generated)
 * - X-Span-ID: Parent span ID from upstream caller
 * - X-Correlation-ID: User/client correlation ID
 */

const crypto = require('crypto');
const { context, getContext } = require('../utils/async-context');

/**
 * Generate a unique ID for tracing
 * Uses UUID v4 format for compatibility
 */
function generateId() {
    return crypto.randomUUID();
}

/**
 * Generate a short span ID (16 hex characters)
 */
function generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Tracing Middleware
 * Extracts or generates trace context and propagates through AsyncLocalStorage
 */
function tracingMiddleware(req, res, next) {
    // Extract or generate trace ID
    const traceId = req.headers['x-trace-id'] ||
        req.headers['x-request-id'] ||
        generateId();

    // Generate new span ID for this request
    const spanId = generateSpanId();

    // Extract parent span ID if provided (for nested calls)
    const parentSpanId = req.headers['x-span-id'] || null;

    // Correlation ID: use provided or fallback to trace ID
    const correlationId = req.headers['x-correlation-id'] || traceId;

    // Build trace context
    const traceContext = {
        traceId,
        spanId,
        parentSpanId,
        correlationId,
        startTime: Date.now()
    };

    // Attach to request object for easy access
    req.traceContext = traceContext;
    req.traceId = traceId;
    req.spanId = spanId;
    req.correlationId = correlationId;

    // Set response headers for downstream consumers
    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('X-Span-ID', spanId);
    res.setHeader('X-Correlation-ID', correlationId);

    // Run request within async context for propagation to services
    const store = {
        traceId,
        spanId,
        parentSpanId,
        correlationId,
        startTime: traceContext.startTime,
        // Include user info if available (populated by auth middleware later)
        userId: req.user?.id || req.headers['x-user-id'] || null
    };

    context.run(store, () => {
        next();
    });
}

/**
 * Get current trace context from AsyncLocalStorage
 * Can be called from any service without passing context explicitly
 */
function getTraceContext() {
    return getContext() || {
        traceId: 'no-trace',
        spanId: 'no-span',
        parentSpanId: null,
        correlationId: 'no-correlation'
    };
}

/**
 * Create a child span for nested operations
 * @param {string} operationName - Name of the operation for logging
 * @returns {Object} Child span context
 */
function createChildSpan(operationName) {
    const parent = getTraceContext();
    const childSpanId = generateSpanId();

    return {
        traceId: parent.traceId,
        spanId: childSpanId,
        parentSpanId: parent.spanId,
        correlationId: parent.correlationId,
        operationName,
        startTime: Date.now()
    };
}

/**
 * Calculate duration from trace context start time
 */
function getDuration(traceContext) {
    if (traceContext?.startTime) {
        return Date.now() - traceContext.startTime;
    }
    return 0;
}

module.exports = {
    tracingMiddleware,
    getTraceContext,
    createChildSpan,
    getDuration,
    generateId,
    generateSpanId
};
