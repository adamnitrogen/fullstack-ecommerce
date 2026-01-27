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
    'EMAIL_ALREADY_EXISTS': 'errors.auth.account_exists',
    'ACCOUNT_ALREADY_EXISTS': 'errors.auth.account_already_exists',
    'INVALID_CREDENTIALS': 'errors.auth.invalid_password', // Mapping to generic invalid password for security or specific if exists

    // Auth Success
    'LOGIN_SUCCESS': 'success.auth.login',
    'REGISTER_SUCCESS': 'success.auth.register',
    'OTP_SENT': 'success.auth.otp_sent',
    'EMAIL_VERIFIED': 'success.auth.email_verified',
    'PASSWORD_UPDATED': 'success.auth.password_updated',
    'LOGOUT_SUCCESS': 'success.auth.logout',
    'SESSION_SYNCED': 'success.auth.session_synced',
    'TOKEN_REFRESHED': 'success.auth.token_refreshed',
    'ORDER_STATUS_UPDATED': 'success.order.status_updated',
    'ORDER_STATUS_UPDATED_REFUND': 'success.order.status_updated_refund',
    'ORDER_CANCELLED': 'success.order.cancelled',
    'ORDER_CANCELLED_REFUND': 'success.order.cancelled_refund',
    'RETURN_REQUESTED': 'success.order.return_requested',

    // Checkout & Payment Errors
    'PAYMENT_FAILED': 'errors.payment.payment_failed',
    'RAZORPAY_ERROR': 'errors.payment.razorpay_error',
    'INVALID_PAYMENT_SIGNATURE': 'errors.payment.invalid_signature',
    'INVALID_COUPON': 'errors.payment.invalid_coupon',
    'ORDER_CREATION_FAILED': 'errors.payment.order_creation_failed',
    'GATEWAY_ERROR': 'errors.payment.gateway_error',
    'REFUND_FAILED_NO_ID': 'errors.payment.refund_failed_no_id',
    'PAYMENT_REFUNDED_FAILURE': 'errors.payment.refunded_on_failure',
    'SIGNATURE_INVALID': 'errors.payment.signature_invalid',
    'VERIFICATION_FAILED': 'errors.payment.verification_failed',
    'ORDER_FAILED_REFUNDED': 'errors.payment.order_failed_refunded',
    'EMPTY_CART': 'errors.checkout.empty_cart',
    'BILLING_ADDRESS_NOT_FOUND': 'errors.checkout.billing_address_not_found',
    'SHIPPING_ADDRESS_NOT_FOUND': 'errors.checkout.shipping_address_not_found',
    'PRODUCT_REQUIRED': 'errors.checkout.product_required',
    'INVALID_QUANTITY': 'errors.checkout.invalid_quantity',
    'INVALID_SESSION': 'errors.checkout.invalid_session',
    'PROFILE_INCOMPLETE': 'errors.checkout.profile_incomplete',
    'SYSTEM_ERROR': 'errors.system.internal_error',
    'ORDER_NUMBER_FAILED': 'errors.checkout.order_number_failed',

    // Inventory & Products
    'INSUFFICIENT_STOCK': 'errors.inventory.insufficient_stock',
    'PRODUCT_NOT_FOUND': 'errors.inventory.product_not_found',

    // General System Errors
    'INTERNAL_ERROR': 'errors.system.internal_error',
    'DATABASE_ERROR': 'errors.system.database_error',
    'VALIDATION_ERROR': 'errors.system.validation_error',

    // Profile
    'PROFILE_UPDATED': 'success.profile.updated',
    'AVATAR_UPLOADED': 'success.profile.avatar_uploaded',
    'AVATAR_DELETED': 'success.profile.avatar_deleted',
    'ACCOUNT_DELETED': 'success.profile.account_deleted',
    'PROFILE_NOT_FOUND': 'errors.profile.not_found',
    'FIRST_NAME_REQUIRED': 'errors.profile.first_name_required',
    'INVALID_GENDER': 'errors.profile.invalid_gender',
    'INVALID_PHONE': 'errors.profile.invalid_phone',
    'NO_IMAGE': 'errors.profile.no_image',
    'NO_AVATAR_TO_DELETE': 'errors.profile.no_avatar_to_delete',
    'PROFILE_INCOMPLETE': 'errors.profile.incomplete',

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
