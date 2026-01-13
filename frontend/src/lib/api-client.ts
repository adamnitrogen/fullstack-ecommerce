import { logger } from "@/lib/logger";
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { logAPICall, logPageAction } from '@/lib/logger';
import { ApiErrorResponse } from "@/types";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

interface CustomAxiosConfig extends InternalAxiosRequestConfig {
    metadata?: {
        startTime: number;
        correlationId: string;
    };
    _retry?: boolean;
}

const IDEMPOTENCY_ROUTES = [
    '/checkout/create-payment-order',
    '/checkout/verify-payment',
    '/donations/create-order',
    '/donations/create-subscription',
    '/donations/verify'
];

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function requiresIdempotencyKey(url: string | undefined, method: string | undefined): boolean {
    if (!url || method?.toUpperCase() !== 'POST') return false;
    return IDEMPOTENCY_ROUTES.some(route => url.includes(route));
}

// Singleton promise for simultaneous refresh requests
let refreshPromise: Promise<import('axios').AxiosResponse<unknown>> | null = null;
let sessionExpiredHandled = false;

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
    timeout: 30000,
});

apiClient.interceptors.request.use(
    (config) => {
        const correlationId = generateUUID();
        (config as CustomAxiosConfig).metadata = {
            startTime: Date.now(),
            correlationId
        };
        config.headers['X-Correlation-ID'] = correlationId;
        if (requiresIdempotencyKey(config.url, config.method)) {
            config.headers['X-Idempotency-Key'] = generateUUID();
        }
        logPageAction('APIRequestStarted', {
            method: config.method?.toUpperCase(),
            url: config.url,
            correlationId
        });
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => {
        const config = response.config as CustomAxiosConfig;
        const duration = config.metadata?.startTime ? Date.now() - config.metadata.startTime : 0;
        logAPICall(config.url || 'unknown', config.method?.toUpperCase() || 'UNKNOWN', response.status, duration, config.metadata?.correlationId);
        sessionExpiredHandled = false;
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosConfig | undefined;

        if (originalRequest) {
            const duration = originalRequest.metadata?.startTime ? Date.now() - originalRequest.metadata.startTime : 0;
            logAPICall(originalRequest.url || 'unknown', originalRequest.method?.toUpperCase() || 'UNKNOWN', error.response?.status || 0, duration, originalRequest.metadata?.correlationId);
        }

        // 401 Unauthorized -> Refresh
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            const isAuthEndpoint = originalRequest.url?.includes('/auth/refresh') ||
                originalRequest.url?.includes('/auth/register') ||
                originalRequest.url?.includes('/auth/validate-credentials') ||
                originalRequest.url?.includes('/auth/verify-login-otp');

            if (isAuthEndpoint) return Promise.reject(error);

            originalRequest._retry = true;

            try {
                if (!refreshPromise) {
                    refreshPromise = (async () => {
                        try {
                            // Use Web Locks API to synchronize across tabs
                            if (typeof navigator !== 'undefined' && navigator.locks) {
                                return await navigator.locks.request('auth_refresh_lock', async () => {
                                    // Once we have the lock, checks if we really need to refresh.
                                    // Another tab might have just refreshed it.
                                    // We can verify this by trying a lightweight request or just proceeding 
                                    // if we assume the cookie jar is updated.

                                    // Simple approach: Just proceed. Supabase allows chaining (A->A'->A'').
                                    // The lock ensures we don't send 'A' twice efficiently.
                                    // But to be even safer, we could try the original request first?
                                    // No, we can't easily replay originalRequest here without it being messy.
                                    // Let's just call refresh. The browser will send the *latest* cookie it has.

                                    logger.debug('[API Client] Acquired refresh lock, starting token refresh...');
                                    const res = await apiClient.post('/auth/refresh');
                                    logger.debug('[API Client] Refresh success');

                                    // Sync Supabase Client SDK with new tokens
                                    const { tokens } = res.data;
                                    if (tokens?.access_token && tokens?.refresh_token) {
                                        const { error } = await supabase.auth.setSession({
                                            access_token: tokens.access_token,
                                            refresh_token: tokens.refresh_token
                                        });
                                        if (error) logger.warn("[API Client] Supabase session sync warning:", error);
                                        else logger.debug("[API Client] Supabase session synced with new tokens");
                                    }

                                    sessionExpiredHandled = false;
                                    return res;
                                });
                            } else {
                                // Fallback for environments without Web Locks (should be rare in modern browsers)
                                logger.debug('[API Client] Starting token refresh (no lock capability)...');
                                const res = await apiClient.post('/auth/refresh');
                                logger.debug('[API Client] Refresh success');

                                // Sync Supabase Client SDK with new tokens
                                const { tokens } = res.data;
                                if (tokens?.access_token && tokens?.refresh_token) {
                                    const { error } = await supabase.auth.setSession({
                                        access_token: tokens.access_token,
                                        refresh_token: tokens.refresh_token
                                    });
                                    if (error) logger.warn("[API Client] Supabase session sync warning:", error);
                                    else logger.debug("[API Client] Supabase session synced with new tokens");
                                }

                                sessionExpiredHandled = false;
                                return res;
                            }
                        } catch (err) {
                            logger.debug('[API Client] Refresh failure');
                            throw err;
                        } finally {
                            refreshPromise = null;
                        }
                    })();
                }

                await refreshPromise;
                logger.debug('[API Client] Retrying original request');
                return apiClient(originalRequest);
            } catch (error: unknown) {
                const refreshError = error as AxiosError<ApiErrorResponse>;
                // Refresh failed - notify app

                if (!sessionExpiredHandled) {
                    sessionExpiredHandled = true;
                    logger.warn('[API Client] Session expired permanently, notifying app');
                    window.dispatchEvent(new CustomEvent('auth:session-expired', {
                        detail: {
                            url: originalRequest.url,
                            message: refreshError.response?.data?.error || 'Session expired'
                        }
                    }));
                }
                return Promise.reject(refreshError);
            }
        }



        // ... existing imports

        // Normalize error messages
        if (error.response) {
            const data = error.response.data as ApiErrorResponse | { error?: string; message?: string };
            const serverMessage = ('error' in data ? data.error : (data as { message?: string }).message);
            if (serverMessage && typeof serverMessage === 'string') {
                error.message = serverMessage;
            } else {
                const status = error.response.status;
                if (status === 404) error.message = "Resource not found.";
                else if (status === 403) error.message = "Access denied.";
                else if (status === 500) error.message = "Server error. Please try again.";
                else if (status === 401) error.message = "Session expired.";
            }
        }

        return Promise.reject(error);
    }
);
