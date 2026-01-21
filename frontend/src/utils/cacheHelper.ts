/**
 * Client-side Cache Helper
 * Provides localStorage/sessionStorage caching with TTL expiration
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface CacheOptions {
    /** Time-to-live in milliseconds (default: 1 hour) */
    ttl?: number;
    /** Use sessionStorage instead of localStorage (default: false) */
    useSessionStorage?: boolean;
}

class CacheHelper {
    private static readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

    /**
     * Get data from cache
     * @returns Cached data if valid, null if expired or not found
     */
    static get<T>(key: string, useSessionStorage = false): T | null {
        try {
            const storage = useSessionStorage ? sessionStorage : localStorage;
            const item = storage.getItem(key);

            if (!item) {
                return null;
            }

            const entry: CacheEntry<T> = JSON.parse(item);
            const now = Date.now();

            // Check if expired
            if (now - entry.timestamp > entry.ttl) {
                console.log(`[Cache] EXPIRED: ${key}`);
                storage.removeItem(key);
                return null;
            }

            console.log(`[Cache] HIT: ${key}`);
            return entry.data;
        } catch (error) {
            console.error(`[Cache] Error reading ${key}:`, error);
            return null;
        }
    }

    /**
     * Set data in cache with TTL
     */
    static set<T>(key: string, data: T, options: CacheOptions = {}): void {
        try {
            const { ttl = this.DEFAULT_TTL, useSessionStorage = false } = options;

            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
                ttl,
            };

            const storage = useSessionStorage ? sessionStorage : localStorage;
            storage.setItem(key, JSON.stringify(entry));
            console.log(`[Cache] SET: ${key} (TTL: ${ttl}ms)`);
        } catch (error) {
            console.error(`[Cache] Error writing ${key}:`, error);
        }
    }

    /**
     * Remove specific cache entry
     */
    static remove(key: string, useSessionStorage = false): void {
        try {
            const storage = useSessionStorage ? sessionStorage : localStorage;
            storage.removeItem(key);
            console.log(`[Cache] REMOVED: ${key}`);
        } catch (error) {
            console.error(`[Cache] Error removing ${key}:`, error);
        }
    }

    /**
     * Clear all cache entries matching a prefix
     */
    static clearByPrefix(prefix: string, useSessionStorage = false): void {
        try {
            const storage = useSessionStorage ? sessionStorage : localStorage;
            const keysToRemove: string[] = [];

            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => storage.removeItem(key));
            console.log(`[Cache] CLEARED ${keysToRemove.length} entries with prefix: ${prefix}`);
        } catch (error) {
            console.error(`[Cache] Error clearing prefix ${prefix}:`, error);
        }
    }

    /**
     * Clear all cache entries
     */
    static clearAll(useSessionStorage = false): void {
        try {
            const storage = useSessionStorage ? sessionStorage : localStorage;
            storage.clear();
            console.log('[Cache] CLEARED ALL');
        } catch (error) {
            console.error('[Cache] Error clearing all:', error);
        }
    }

    /**
     * Get or fetch data with cache
     * @param key Cache key
     * @param fetchFn Function to fetch data if cache miss
     * @param options Cache options
     * @returns Cached or freshly fetched data
     */
    static async getOrFetch<T>(
        key: string,
        fetchFn: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T> {
        // Try cache first
        const cached = this.get<T>(key, options.useSessionStorage);
        if (cached !== null) {
            return cached;
        }

        // Cache miss - fetch fresh data
        console.log(`[Cache] MISS: ${key} - fetching fresh data`);
        const data = await fetchFn();

        // Store in cache
        this.set(key, data, options);

        return data;
    }

    /**
     * Clear only expired cache entries
     */
    static clearExpired(useSessionStorage = false): void {
        try {
            const storage = useSessionStorage ? sessionStorage : localStorage;
            const keysToRemove: string[] = [];
            const now = Date.now();

            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key) {
                    try {
                        const item = storage.getItem(key);
                        if (item) {
                            const entry: CacheEntry<any> = JSON.parse(item);
                            // Check if it looks like a cache entry and is expired
                            if (entry.timestamp && entry.ttl && (now - entry.timestamp > entry.ttl)) {
                                keysToRemove.push(key);
                            }
                        }
                    } catch {
                        // Not a cache entry, skip
                    }
                }
            }

            keysToRemove.forEach(key => storage.removeItem(key));
            if (keysToRemove.length > 0) {
                console.log(`[Cache] Cleared ${keysToRemove.length} expired entries`);
            }
        } catch (error) {
            console.error('[Cache] Error clearing expired entries:', error);
        }
    }

    /**
     * Initialize cache cleanup on page load
     * Clears all cached data when page is hard-reloaded (F5, Ctrl+R)
     * to ensure fresh data after explicit user reload
     */
    static initPageReloadHandler(clearOnReload = true): void {
        if (typeof window === 'undefined') return;

        // Detect page reload (vs SPA navigation)
        const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        const isReload = navigationEntries.length > 0 && navigationEntries[0].type === 'reload';

        if (isReload && clearOnReload) {
            console.log('[Cache] Page reload detected - clearing cache for fresh data');
            // Clear application cache (keep other localStorage data intact)
            this.remove('active_coupons');
            this.remove('user_addresses');
        } else {
            // On normal page load, just clear expired entries
            this.clearExpired();
        }
    }
}

export default CacheHelper;

