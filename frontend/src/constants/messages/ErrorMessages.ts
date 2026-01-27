export class ErrorMessages {
    static readonly AUTH_INVALID_EMAIL_PHONE = "errors.auth.invalidEmailPhone";
    static readonly AUTH_INVALID_OTP = "errors.auth.invalidOtp";
    static readonly AUTH_CHECK_INFO = "errors.auth.checkInfo";
    static readonly AUTH_FIX_ERRORS = "errors.auth.fixErrors";
    static readonly AUTH_NOTICE = "errors.auth.notice";
    static readonly AUTH_ERROR_OCCURRED = "errors.auth.errorOccurred";

    static readonly SYSTEM_INTERNAL_ERROR = "errors.system.internal_error";
    static readonly SYSTEM_NETWORK_ERROR = "errors.system.network_error";
    static readonly SYSTEM_VALIDATION_ERROR = "errors.system.validation_error";

    static readonly AUTH_LOGIN_REQUIRED = "errors.auth.login_required";
    static readonly AUTH_SESSION_EXPIRED = "errors.auth.session_expired";
    static readonly AUTH_FORBIDDEN = "errors.auth.forbidden";

    static readonly PAYMENT_FAILED = "errors.payment.failed";
    static readonly PAYMENT_GATEWAY_ERROR = "errors.payment.gateway_error";

    static readonly INVENTORY_INSUFFICIENT_STOCK = "errors.inventory.insufficient_stock";

    // Friendly Titles
    static readonly TITLE_CHECK_INFO = "errors.titles.check_info";
    static readonly TITLE_LOGIN_REQUIRED = "errors.titles.login_required";
    static readonly TITLE_PAYMENT_UPDATE = "errors.titles.payment_update";
    static readonly TITLE_STOCK_UPDATE = "errors.titles.stock_update";
    static readonly TITLE_OOPS = "errors.titles.oops";
    static readonly TITLE_CONNECTION_ISSUE = "errors.titles.connection_issue";
}
