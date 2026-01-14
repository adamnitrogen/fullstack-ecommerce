const logger = require('../utils/logger');
const { supabase, supabaseAdmin } = require('../lib/supabase');
const MemoryStore = require('../lib/store/memory.store');
const { getContext } = require('../utils/async-context');

// Cache for Auth Tokens to reduce Supabase API calls
// Key: Access Token (hashed for security), Value: User Object
const authCache = new MemoryStore();
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hash token for cache key (don't store raw tokens as keys)
 */
function hashToken(token) {
    // Simple hash for cache key - not cryptographic, just for key generation
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `auth_${hash}`;
}

/**
 * Middleware to verify JWT token from cookies or Authorization header
 */
async function authenticateToken(req, res, next) {
    try {
        // Extract token - PRIORITIZE COOKIE over Authorization header
        let token = req.cookies?.access_token;

        logger.debug({
            msg: '[AuthMiddleware] Request Details',
            method: req.method,
            url: req.originalUrl,
            hasCookies: !!req.cookies?.access_token
        });

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
                logger.debug('[AuthMiddleware] Token found in Authorization header');
            }
        } else {
            logger.debug('[AuthMiddleware] Token found in Cookies');
        }

        if (!token) {
            logger.debug('[AuthMiddleware] No token found');
            return res.status(401).json({ error: 'Access token required' });
        }

        // 1. Check Cache first (reduces Supabase API calls)
        const cacheKey = hashToken(token);
        const cachedUser = await authCache.get(cacheKey);

        if (cachedUser) {
            logger.debug('[AuthMiddleware] Cache hit');
            req.user = cachedUser;

            // Context Enrichment
            const store = getContext();
            if (store) store.userId = cachedUser.id;

            return next();
        }

        logger.debug('[AuthMiddleware] Cache miss, validating with Supabase...');

        // 2. Validate token using Supabase Admin
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            logger.warn({ err: error?.message }, '[AuthMiddleware] Supabase validation failed');
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // 3. Check Account Deletion Status (Critical Security Check)
        const { data: profile } = await supabase
            .from('profiles')
            .select('deletion_status')
            .eq('id', user.id)
            .single();

        const deletionStatus = profile?.deletion_status || 'ACTIVE';

        // ENFORCE ACCESS RULES
        if (deletionStatus === 'DELETED') {
            return res.status(410).json({ error: 'Account deleted', code: 'ACCOUNT_DELETED' });
        }
        if (deletionStatus === 'DELETION_IN_PROGRESS') {
            return res.status(403).json({ error: 'Account deletion in progress', code: 'DELETION_IN_PROGRESS' });
        }
        if (deletionStatus === 'PENDING_DELETION' || deletionStatus === 'PENDING_DELETION_BLOCKED') {
            // Allow access ONLY to essential auth and deletion endpoints
            const allowedPaths = [
                '/api/auth/refresh',
                '/api/auth/logout',
                '/api/auth/me',
                '/api/auth/sync',
                '/api/account/delete/cancel',
                '/api/account/delete/status'
            ];

            const isAllowed = allowedPaths.some(path => req.originalUrl.startsWith(path));

            if (!isAllowed) {
                logger.warn({ userId: user.id, path: req.originalUrl }, '[AuthMiddleware] Access blocked for account pending deletion');
                return res.status(403).json({
                    error: 'Account pending deletion. Please reactivate or logout.',
                    code: 'ACCOUNT_PENDING_DELETION'
                });
            }
        }

        logger.debug(`[AuthMiddleware] Supabase validation success for user ${user.id}`);

        // 4. Build user object
        const appUser = {
            id: user.id,
            userId: user.id, // Compatibility
            email: user.email,
            role: user.user_metadata?.role || 'customer',
            deletionStatus, // Add status to user object
            ...user.user_metadata
        };

        req.user = appUser;

        // Context Enrichment
        const store = getContext();
        if (store) store.userId = appUser.id;

        // 5. Cache the result
        await authCache.set(cacheKey, appUser, AUTH_CACHE_TTL);

        logger.debug(`[AuthMiddleware] Authenticated user ${appUser.id}, cached for ${AUTH_CACHE_TTL}ms`);

        next();
    } catch (error) {
        logger.error({ err: error }, '[AuthMiddleware] Error');
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
}

/**
 * Middleware to check if user has required role
 */
function authorizeRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            logger.warn({
                msg: 'Access Forbidden: Role mismatch',
                required: allowedRoles,
                actual: req.user.role,
                userId: req.user.id
            });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

/**
 * Optional authentication - doesn't fail if no token, but returns 401 if token is invalid
 * This allows the frontend to attempt a refresh on expired tokens.
 */
async function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.access_token;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        // No token = guest user (allowed)
        if (!token) {
            req.user = null;
            return next();
        }

        // 1. Check Cache first
        const cacheKey = hashToken(token);
        const cachedUser = await authCache.get(cacheKey);

        if (cachedUser) {
            req.user = cachedUser;
            const store = getContext();
            if (store) store.userId = cachedUser.id;
            return next();
        }

        // 2. Validate token using Supabase Admin
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            // Token provided but invalid/expired - return 401 so frontend can refresh
            logger.debug({ err: error?.message }, '[AuthMiddleware] Optional auth: token expired');
            return res.status(401).json({ error: 'Session expired', code: 'TOKEN_EXPIRED' });
        }

        // 3. Build and cache user
        const appUser = {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: user.user_metadata?.role || 'customer',
            ...user.user_metadata
        };

        req.user = appUser;

        const store = getContext();
        if (store) store.userId = appUser.id;

        await authCache.set(cacheKey, appUser, AUTH_CACHE_TTL);

        next();
    } catch (error) {
        logger.error({ err: error }, '[AuthMiddleware] Optional Auth Error');
        req.user = null;
        next();
    }
}

/**
 * Invalidate a token from the cache (e.g., on logout)
 */
async function invalidateAuthCache(token) {
    if (token) {
        const cacheKey = hashToken(token);
        await authCache.delete(cacheKey);
        logger.debug('[AuthMiddleware] Cache invalidated');
    }
}

module.exports = {
    authenticateToken,
    authorizeRole,
    requireRole: authorizeRole, // Alias
    optionalAuth,
    invalidateAuthCache
};
