/**
 * User-friendly error messages mapping
 */
const ERROR_MESSAGES = {
    // Auth Errors
    'AUTHENTICATION_REQUIRED': 'Please log in to continue.',
    'UNAUTHORIZED': 'Your session has expired. Please log in again.',
    'FORBIDDEN': "You don't have permission to perform this action.",

    // Checkout & Payment Errors
    'PAYMENT_FAILED': 'Your payment could not be processed. Please check your details and try again.',
    'RAZORPAY_ERROR': 'We encountered an issue with the payment gateway. Please try again in a moment.',
    'INVALID_PAYMENT_SIGNATURE': 'Payment verification failed. If money was deducted, please contact support.',
    'INVALID_COUPON': 'This coupon code is no longer valid or applicable.',

    // Inventory & Products
    'INSUFFICIENT_STOCK': 'Some items in your cart are no longer available in the requested quantity.',
    'PRODUCT_NOT_FOUND': 'This product is no longer available.',

    // General System Errors
    'INTERNAL_ERROR': 'Something went wrong on our end. We have been notified and are looking into it.',
    'DATABASE_ERROR': 'We are experiencing some technical difficulties with our database. Please try again shortly.',
    'VALIDATION_ERROR': 'Please check the information you entered and try again.',

    // Fallback
    'GENERIC_ERROR': 'An unexpected error occurred. Please try again or contact support.'
};

/**
 * Technical patterns to exclude or translate
 */
const TECHNICAL_PATTERNS = [
    /column ".*" does not exist/i,
    /relation ".*" does not exist/i,
    /violates foreign key constraint/i,
    /violates not-null constraint/i,
    /syntax error at or near/i,
    /null reference/i,
    /undefined reference/i,
    /stack trace/i,
    /razorpay_.*_id/i,
    /gst_rate_.*_error/i,
    /supabase/i,
    /postgresql/i,
    /error code: \d+/i,
    /unexpected token/i,
    /failed to fetch/i,
    /axios/i,
    /fetch/i,
    /internal server error/i,
    /read property/i,
    /is not a function/i
];

/**
 * Translates an error or message into a user-friendly one
 * @param {Error|string} err 
 * @param {number} statusCode 
 * @returns {string}
 */
const getFriendlyMessage = (err, statusCode) => {
    const message = typeof err === 'string' ? err : (err.message || '');
    const code = err.code || '';

    // If it's already a friendly message (doesn't match technical patterns), return it
    const isTechnical = TECHNICAL_PATTERNS.some(pattern => pattern.test(message)) ||
        TECHNICAL_PATTERNS.some(pattern => pattern.test(code));

    if (!isTechnical && message && statusCode < 500) {
        return message;
    }

    // Map by code
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];

    // Map by status code
    if (statusCode === 401) return ERROR_MESSAGES.AUTHENTICATION_REQUIRED;
    if (statusCode === 403) return ERROR_MESSAGES.FORBIDDEN;
    if (statusCode === 404) return ERROR_MESSAGES.PRODUCT_NOT_FOUND;
    if (statusCode >= 500) return ERROR_MESSAGES.INTERNAL_ERROR;

    return ERROR_MESSAGES.GENERIC_ERROR;
};

module.exports = {
    ERROR_MESSAGES,
    getFriendlyMessage
};
