import { ApiErrorResponse } from "@/types";
import axios, { AxiosError } from "axios";

const FRIENDLY_MESSAGES: Record<string, string> = {
    'AUTHENTICATION_REQUIRED': 'Please log in to continue.',
    'UNAUTHORIZED': 'Your session has expired. Please log in again.',
    'FORBIDDEN': "You don't have permission to perform this action.",
    'PAYMENT_FAILED': 'Your payment could not be processed. Please check your details and try again.',
    'RAZORPAY_ERROR': 'We encountered an issue with the payment gateway. Please try again in a moment.',
    'INSUFFICIENT_STOCK': 'Some items in your cart are no longer available in the requested quantity.',
    'INTERNAL_ERROR': 'Something went wrong on our end. We are looking into it.',
    'NETWORK_ERROR': 'We are having trouble connecting to the server. Please check your internet connection.',
    'VALIDATION_ERROR': 'Check your information and try again.',
};

/**
 * Returns a user-friendly Title for an error
 */
export function getFriendlyTitle(error: unknown, defaultTitle: string = "Notice"): string {
    const apiError = getApiError(error);
    const code = apiError?.code;

    if (code === 'VALIDATION_ERROR') return 'Check your info';
    if (code === 'AUTHENTICATION_REQUIRED' || code === 'UNAUTHORIZED') return 'Login Required';
    if (code === 'PAYMENT_FAILED' || code === 'RAZORPAY_ERROR') return 'Payment Update';
    if (code === 'INSUFFICIENT_STOCK') return 'Stock Update';
    if (code === 'INTERNAL_ERROR') return 'Oops!';

    if (isNetworkError(error)) return 'Connection Issue';

    return defaultTitle;
}

export function getApiError(error: unknown): ApiErrorResponse | undefined {
    if (axios.isAxiosError(error)) {
        return error.response?.data as ApiErrorResponse;
    }
    return undefined;
}

export function getErrorMessage(error: unknown, defaultMessage: string = "An error occurred"): string {
    if (typeof error === 'string') return error;

    if (isNetworkError(error)) {
        return FRIENDLY_MESSAGES.NETWORK_ERROR;
    }

    const apiError = getApiError(error);

    // Check if we have a known error code
    const code = apiError?.code;
    if (code && FRIENDLY_MESSAGES[code]) {
        return FRIENDLY_MESSAGES[code];
    }

    // Use the error message from the API if it exists and isn't technical
    if (apiError?.error) {
        // Simple heuristic: if it contains technical words, use default
        const technicalPatterns = [/sql/i, /database/i, /stack/i, /null/i, /undefined/i, /line \d+/i, /column/i];
        const isTechnical = technicalPatterns.some(p => p.test(apiError.error));
        if (!isTechnical) return apiError.error;
    }

    if (error instanceof Error) {
        // Don't leak raw Error messages which might have dev-centric info
        if (error.message.includes('Network Error')) return FRIENDLY_MESSAGES.NETWORK_ERROR;
        return defaultMessage;
    }

    return defaultMessage;
}

export function getErrorDetails(error: unknown): Array<{ path: string[]; message: string }> | undefined {
    const apiError = getApiError(error);
    // Support both 'details' (new structure) and direct 'details' from error object (legacy/Supabase)
    if (apiError?.details && Array.isArray(apiError.details)) {
        return apiError.details.map(d => ({
            path: [d.field],
            message: d.message
        }));
    }

    // Checking for raw details in the error object (e.g. from Supabase or custom errors)
    if (error && typeof error === 'object' && 'details' in error) {
        const potentialDetails = (error as any).details;
        if (Array.isArray(potentialDetails)) {
            return potentialDetails as Array<{ path: string[]; message: string }>;
        }
    }

    return undefined;
}

export function isNetworkError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
        // Network errors (like connection refused, DNS fail) usually have no response
        return !error.response && !!error.code && error.code !== 'ERR_CANCELED';
    }
    return false;
}

export function isNotFoundError(error: unknown): boolean {
    const apiError = getApiError(error);
    if (apiError?.status === 404) return true;

    if (axios.isAxiosError(error)) {
        return error.response?.status === 404;
    }
    return false;
}
