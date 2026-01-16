import { ApiErrorResponse } from "@/types";
import { AxiosError } from "axios";

export function getApiError(error: unknown): ApiErrorResponse | undefined {
    if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        return axiosError.response?.data;
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
        // Map our ApiErrorResponse details (field/message) to a standard path/message if needed,
        // or just return as is if the component expects field/message.
        // Looking at Auth.tsx, it expects path/message.
        return apiError.details.map(d => ({
            path: [d.field],
            message: d.message
        }));
    }

    if (error && typeof error === 'object' && 'details' in error && Array.isArray((error as { details: unknown[] }).details)) {
        return (error as { details: Array<{ path: string[]; message: string }> }).details;
    }

    return undefined;
}
