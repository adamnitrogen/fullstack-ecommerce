/**
 * i18n Compatible Error Keys mapping
 * Keys follow the structure: error.<category>.<code_name>
 */
const ERROR_MESSAGES = {
    // Auth Errors
    'AUTHENTICATION_REQUIRED': 'errors.auth.authentication_required',
    'UNAUTHORIZED': 'errors.auth.unauthorized',
    'FORBIDDEN': 'errors.auth.forbidden',
    'INVALID_PASSWORD': 'errors.auth.invalid_password',
    'ACCOUNT_NOT_FOUND': 'errors.auth.account_not_found',
    'ACCOUNT_BLOCKED': 'errors.auth.account_blocked',
    'ACCOUNT_DELETED': 'errors.auth.account_deleted',

    // Checkout & Payment Errors
    'PAYMENT_FAILED': 'errors.payment.payment_failed',
    'RAZORPAY_ERROR': 'errors.payment.razorpay_error',
    'INVALID_PAYMENT_SIGNATURE': 'errors.payment.invalid_signature',
    'INVALID_COUPON': 'errors.payment.invalid_coupon',

    // Inventory & Products
    'INSUFFICIENT_STOCK': 'errors.inventory.insufficient_stock',
    'PRODUCT_NOT_FOUND': 'errors.inventory.product_not_found',

    // General System Errors
    'INTERNAL_ERROR': 'errors.system.internal_error',
    'DATABASE_ERROR': 'errors.system.database_error',
    'VALIDATION_ERROR': 'errors.system.validation_error',

    // Fallback
    'GENERIC_ERROR': 'errors.system.generic_error'
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
    /is not a function/i,
    /cannot read/i,
    /property of null/i,
    /property of undefined/i,
    /invalid input/i
];

/**
 * Translates an error or message into a user-friendly key
 * @param {Error|string} err 
 * @param {number} statusCode 
 * @returns {string}
 */
const getFriendlyMessage = (err, statusCode) => {
    const message = typeof err === 'string' ? err : (err.message || '');
    const code = err.code || '';

    // If it's a known error key already, return it
    if (Object.values(ERROR_MESSAGES).includes(message)) {
        return message;
    }

    // Map by code
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];

    // Status code fallbacks
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
