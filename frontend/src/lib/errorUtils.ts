import { ApiErrorResponse } from "@/types";
import axios, { AxiosError } from "axios";

export function getApiError(error: unknown): ApiErrorResponse | undefined {
    if (axios.isAxiosError(error)) {
        return error.response?.data as ApiErrorResponse;
    }
    return undefined;
}

export function getErrorMessage(error: unknown, defaultMessage: string = "An error occurred"): string {
    if (typeof error === 'string') return error;

    const apiError = getApiError(error);
    if (apiError?.error) return apiError.error;

    if (error instanceof Error) return error.message;

    if (error && typeof error === 'object' && 'message' in error) {
        return (error as { message: string }).message;
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
