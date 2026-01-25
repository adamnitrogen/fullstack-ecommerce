/**
 * i18n Compatible Error Keys mapping
 * Keys follow the structure: error.<category>.<code_name>
 */
const I18N_MESSAGES = {
    // Auth Errors
    'AUTHENTICATION_REQUIRED': 'errors.auth.authentication_required',
    'UNAUTHORIZED': 'errors.auth.unauthorized',
    'FORBIDDEN': 'errors.auth.forbidden',
    'INVALID_PASSWORD': 'errors.auth.invalid_password',
    'ACCOUNT_NOT_FOUND': 'errors.auth.account_not_found',
    'ACCOUNT_BLOCKED': 'errors.auth.account_blocked',
    'ACCOUNT_DELETED': 'errors.auth.account_deleted',
    'GOOGLE_AUTH_BLOCKED': 'errors.auth.google_auth_blocked',
    'REFRESH_TOKEN_REQUIRED': 'errors.auth.refresh_token_required',

    // Auth Success
    'LOGIN_SUCCESS': 'success.auth.login',
    'REGISTER_SUCCESS': 'success.auth.register',
    'OTP_SENT': 'success.auth.otp_sent',
    'EMAIL_VERIFIED': 'success.auth.email_verified',
    'PASSWORD_UPDATED': 'success.auth.password_updated',
    'LOGOUT_SUCCESS': 'success.auth.logout',

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
    if (Object.values(I18N_MESSAGES).includes(message)) {
        return message;
    }

    // Map by code
    if (I18N_MESSAGES[code]) return I18N_MESSAGES[code];

    // Status code fallbacks
    if (statusCode === 401) return I18N_MESSAGES.AUTHENTICATION_REQUIRED;
    if (statusCode === 403) return I18N_MESSAGES.FORBIDDEN;
    if (statusCode === 404) return I18N_MESSAGES.PRODUCT_NOT_FOUND;
    if (statusCode >= 500) return I18N_MESSAGES.INTERNAL_ERROR;

    return I18N_MESSAGES.GENERIC_ERROR;
};

/**
 * Get i18n key for a literal name
 * @param {string} keyName 
 * @returns {string}
 */
const getI18nKey = (keyName) => {
    return I18N_MESSAGES[keyName] || keyName;
};

module.exports = {
    I18N_MESSAGES,
    getFriendlyMessage,
    getI18nKey
};
