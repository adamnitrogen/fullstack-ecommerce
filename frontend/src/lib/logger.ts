import * as Sentry from "@sentry/react";
import { apiClient } from "@/lib/api-client";
import { Product } from "@/types";

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

const isProduction = import.meta.env.MODE === 'production';

// Unified Log Context Interface
export interface LogContext {
    module?: string;
    operation?: string;
    context?: Record<string, unknown>;
    error?: Error | unknown;
    [key: string]: unknown; // Allow other properties to be mapped to context
}

// Get New Relic browser agent instance
const getNewRelic = () => (window as unknown as { newrelic?: NewRelicAPI }).newrelic;

interface NewRelicAPI {
    addPageAction: (name: string, attributes?: Record<string, unknown>) => void;
    noticeError: (error: Error, customAttributes?: Record<string, unknown>) => void;
    setCustomAttribute: (name: string, value: string | number | boolean) => void;
    interaction: () => { save: () => void };
}

/**
 * Central Logger Utility
 */
export const logEvent = (level: LogLevel, message: string, data?: LogContext | unknown) => {
    const timestamp = new Date().toISOString();

    // Construct Unified Payload
    const payload: Record<string, unknown> = {
        timestamp,
        level: level.toUpperCase(),
        layer: 'frontend',
        environment: import.meta.env.MODE,
        message
    };

    let contextData: Record<string, unknown> = {};
    let errorObj: Error | undefined;

    if (data && typeof data === 'object' && data !== null) {
        const { module, operation, error, context, ...rest } = data as LogContext;

        payload.module = module || 'Frontend'; // Default module
        payload.operation = operation || 'Log';

        if (error) {
            errorObj = error instanceof Error ? error : new Error(String(error));
            payload.error = {
                name: errorObj.name,
                message: errorObj.message,
                stack: errorObj.stack
            };
        }

        contextData = { ...(context || {}), ...rest };
    } else {
        // Legacy support: data is just random stuff
        payload.module = 'Frontend';
        payload.operation = 'Log';
        if (data) contextData = { data };
    }

    payload.context = contextData;

    // 1. Console Logging
    // DISABLED per user request (Backend logs only)
    /*
    if (!isProduction) {
        // DEVELOPMENT: Log structured object
        const consoleArgs = [
            `[${level.toUpperCase()}] [${payload.module}:${payload.operation}] ${message}`,
            payload.context
        ];
        if (payload.error) consoleArgs.push(payload.error);

        switch (level) {
            case 'debug':
                console.debug(...consoleArgs);
                break;
            case 'info':
                console.info(...consoleArgs);
                break;
            case 'warn':
                console.warn(...consoleArgs);
                break;
            case 'error':
            case 'critical':
                console.error(...consoleArgs);
                break;
        }
        return;
    }
    */

    // 2. PRODUCTION: External services
    if (['warn', 'error', 'critical'].includes(level)) {
        // Console fallback - DISABLED
        // console.warn(`[${level.toUpperCase()}] ${message}`, payload);

        if (['error', 'critical'].includes(level)) {
            // Send to Sentry
            Sentry.captureMessage(message, {
                level: level === 'critical' ? 'fatal' : 'error',
                extra: payload
            });

            // Send to New Relic
            const newrelic = getNewRelic();
            if (newrelic && errorObj) {
                newrelic.noticeError(errorObj, { ...payload, ...contextData });
            }
        }
    } else if (level !== 'debug') {
        // Breadcrumbs for info/warn
        Sentry.addBreadcrumb({
            category: 'log',
            message,
            level: level === 'warn' ? 'warning' : 'info',
            data: payload
        });
    }
};

// ============ New Relic Specific Methods ============

export const logPageAction = (name: string, attributes: Record<string, unknown> = {}): void => {
    // Wrapper to use logEvent logic? Or keep separate? 
    // NewRelic PageAction is specific.
    // Keep console behavior consistent

    if (!isProduction) {
        // console.debug(`[PageAction] ${name}`, attributes);
    }

    const newrelic = getNewRelic();
    if (newrelic) {
        newrelic.addPageAction(name, {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            ...attributes
        });
    }
};

export const logRouteChange = (route: string, previousRoute?: string): void => {
    logPageAction('RouteChange', { route, previousRoute, referrer: document.referrer });
};

export const logFeatureUsage = (featureName: string, details: Record<string, unknown> = {}): void => {
    logEvent('info', `Feature Used: ${featureName}`, {
        module: 'Feature',
        operation: 'USE',
        context: details
    });
    logPageAction('FeatureUsed', { feature: featureName, ...details });
};

export const logAPICall = (endpoint: string, method: string, status: number, duration: number, correlationId?: string, silent?: boolean): void => {
    const success = status >= 200 && status < 400;

    // Don't flood info logs with API calls in prod unless needed
    // But log specific structured event for debugging
    if (!success && !silent) {
        logEvent('error', `API Call Failed: ${method} ${endpoint}`, {
            module: 'APIClient',
            operation: 'REQUEST',
            context: { status, duration, correlationId }
        });
    } else {
        logEvent('debug', `API Call ${success ? 'Success' : 'Failed'}: ${method} ${endpoint}`, {
            module: 'APIClient',
            operation: 'REQUEST',
            context: { status, duration, correlationId }
        });
    }

    logPageAction('APICall', {
        endpoint,
        method,
        status,
        duration,
        correlationId,
        success
    });
};

export const logPerformanceMetric = (name: string, value: number, unit = 'ms'): void => {
    logPageAction('PerformanceMetric', { metricName: name, value, unit });
};

export const setUserContext = (userId: string, userName?: string, userEmail?: string): void => {
    if (!isProduction) {
        // console.debug('[UserContext] Set:', { userId, userName });
    }
    const newrelic = getNewRelic();
    if (newrelic) {
        newrelic.setCustomAttribute('userId', userId);
        if (userName) newrelic.setCustomAttribute('userName', userName);
        if (userEmail) newrelic.setCustomAttribute('userEmail', userEmail);
    }
    Sentry.setUser({ id: userId, username: userName, email: userEmail });
};

export const clearUserContext = (): void => {
    if (!isProduction) {
        // console.debug('[UserContext] Cleared');
    }
    const newrelic = getNewRelic();
    if (newrelic) {
        newrelic.setCustomAttribute('userId', '');
        newrelic.setCustomAttribute('userName', '');
        newrelic.setCustomAttribute('userEmail', '');
    }
    Sentry.setUser(null);
};

export const logBusinessEvent = (eventName: string, attributes: Record<string, unknown> = {}): void => {
    logEvent('info', `Business Event: ${eventName}`, {
        module: 'Business',
        operation: eventName,
        context: attributes
    });
    logPageAction(`BusinessEvent:${eventName}`, attributes);
};

// API Surface
export const logger = {
    debug: (msg: string, data?: LogContext | unknown, p0?: string, product?: Product) => logEvent('debug', msg, data),
    info: (msg: string, data?: LogContext | unknown) => logEvent('info', msg, data),
    warn: (msg: string, data?: LogContext | unknown) => logEvent('warn', msg, data),
    error: (msg: string, data?: LogContext | unknown) => logEvent('error', msg, data),
    critical: (msg: string, data?: LogContext | unknown) => logEvent('critical', msg, data),

    pageAction: logPageAction,
    routeChange: logRouteChange,
    featureUsage: logFeatureUsage,
    apiCall: logAPICall,
    performanceMetric: logPerformanceMetric,
    setUser: setUserContext,
    clearUser: clearUserContext,
    businessEvent: logBusinessEvent,
};
