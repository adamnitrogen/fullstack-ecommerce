import { QueryClient } from "@tanstack/react-query";

/**
 * Optimized QueryClient configuration
 * 
 * Key settings:
 * - staleTime: 5 minutes - prevents refetching data that was just loaded
 * - gcTime: 10 minutes - keeps unused data in cache for quick restoration
 * - refetchOnWindowFocus: disabled - prevents refetch when user returns to tab
 * - refetchOnMount: 'always' only if stale - uses cached data when available
 * - retry: 1 - single retry on failure to avoid hammering failing endpoints
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,        // 5 minutes before data is considered stale
            gcTime: 10 * 60 * 1000,          // 10 minutes cache retention (formerly cacheTime)
            refetchOnWindowFocus: false,      // Don't refetch when user focuses window
            refetchOnReconnect: 'always',     // Refetch when reconnecting to network
            retry: 1,                         // Only 1 retry on failure
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        },
        mutations: {
            retry: 0,                         // No retries for mutations (user should retry)
        },
    },
});
