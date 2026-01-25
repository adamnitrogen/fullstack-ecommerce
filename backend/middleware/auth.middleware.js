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

        logger.info({
            msg: '[AuthMiddleware] Request Details',
            method: req.method,
            url: req.originalUrl,
            hasAccessTokenCookie: !!req.cookies?.access_token,
            hasRefreshTokenCookie: !!req.cookies?.refresh_token,
            authHeader: req.headers.authorization ? 'Present' : 'Missing'
        });

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
                logger.info('[AuthMiddleware] Token found in Authorization header');
            }
        } else {
            logger.info('[AuthMiddleware] Token found in Cookies');
        }

        if (!token) {
            logger.info('[AuthMiddleware] No token found in cookies or headers');
            return res.status(401).json({ error: req.t('errors.auth.authentication_required'), code: 'TOKEN_MISSING' });
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
            logger.info({ err: error?.message }, '[AuthMiddleware] Supabase validation failed (Invalid or expired token)');
            return res.status(401).json({ error: req.t('errors.auth.authentication_required') });
        }

        // 3. Check Account Deletion Status and Role (Critical Security Check)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('deletion_status, roles(name)')
            .eq('id', user.id)
            .single();

        if (profileError) {
            logger.error({ userId: user.id, error: profileError }, '[AuthMiddleware] Profile fetch error');
        }

        const deletionStatus = profile?.deletion_status || 'ACTIVE';

        // Handle both singular join object and possible array join (PostgREST variance)
        let databaseRole = 'customer';
        if (profile?.roles) {
            if (Array.isArray(profile.roles)) {
                databaseRole = profile.roles[0]?.name || 'customer';
            } else {
                databaseRole = profile.roles.name || 'customer';
            }
        }

        // Normalize role to lowercase for robust check
        databaseRole = (databaseRole || 'customer').toLowerCase();

        logger.info({
            userId: user.id,
            deletionStatus,
            databaseRole
        }, '[AuthMiddleware] Role resolution');

        // ENFORCE ACCESS RULES
        if (deletionStatus === 'DELETED') {
            return res.status(410).json({ error: req.t('errors.auth.account_deleted'), code: 'ACCOUNT_DELETED' });
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

        // 4. Build user object - DATABASE ROLE IS SOURCE OF TRUTH
        const appUser = {
            id: user.id,
            userId: user.id, // Compatibility
            email: user.email,
            deletionStatus, // Add status to user object
            ...user.user_metadata,
            role: databaseRole // Prioritize database role last so it wins
        };

        req.user = appUser;

        // Context Enrichment
        const store = getContext();
        if (store) store.userId = appUser.id;

        // 5. Cache the result
        await authCache.set(cacheKey, appUser, AUTH_CACHE_TTL);

        logger.debug(`[AuthMiddleware] Authenticated user ${appUser.id} as ${appUser.role}, cached for ${AUTH_CACHE_TTL}ms`);

        next();
    } catch (error) {
        logger.error({ err: error }, '[AuthMiddleware] Error');
        return res.status(500).json({ error: req.t('errors.system.internal_error') });
    }
}

/**
 * Middleware to check if user has required role
 * Supports both rest parameters: authorizeRole('admin', 'manager')
 * and a single array: authorizeRole(['admin', 'manager'])
 */
function authorizeRole(...roles) {
    const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

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
            return res.status(403).json({ error: req.t('errors.auth.forbidden') });
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

        // 3. Fetch Profile for Status and Role - DATABASE IS SOURCE OF TRUTH
        const { data: profile } = await supabase
            .from('profiles')
            .select('deletion_status, roles(name)')
            .eq('id', user.id)
            .single();

        const deletionStatus = profile?.deletion_status || 'ACTIVE';
        const databaseRole = profile?.roles?.name || 'customer';

        // 4. Build and cache user
        const appUser = {
            id: user.id,
            userId: user.id,
            email: user.email,
            deletionStatus,
            ...user.user_metadata,
            role: databaseRole // Prioritize database role
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

/**
 * Middleware to check if user has specific module permission
 * Admins have all permissions, Managers check manager_permissions table
 */
function checkPermission(permissionName) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Admins can do everything
        if (req.user.role === 'admin') {
            return next();
        }

        if (req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        try {
            // Check cache for permissions
            const cacheKey = `perms_${req.user.id}`;
            let permissions = await authCache.get(cacheKey);

            if (!permissions) {
                logger.debug({ userId: req.user.id }, '[AuthMiddleware] Permission cache miss, fetching from DB');
                const { data, error } = await supabaseAdmin
                    .from('manager_permissions')
                    .select('*')
                    .eq('user_id', req.user.id)
                    .single();

                if (error || !data) {
                    logger.warn({ userId: req.user.id, err: error }, '[AuthMiddleware] Failed to fetch manager permissions');
                    return res.status(403).json({ error: 'Manager profile or permissions not found' });
                }

                permissions = data;
                await authCache.set(cacheKey, permissions, 60 * 1000); // Cache for 1 minute
            }

            if (!permissions.is_active) {
                logger.warn({ userId: req.user.id }, '[AuthMiddleware] Manager account is inactive');
                return res.status(403).json({ error: 'Manager account is currently inactive' });
            }

            if (!permissions[permissionName]) {
                logger.warn({
                    msg: 'Access Forbidden: Permission missing',
                    required: permissionName,
                    userId: req.user.id
                });
                return res.status(403).json({ error: `Insufficient permissions: ${permissionName} required` });
            }

            next();
        } catch (err) {
            logger.error({ err, userId: req.user.id }, '[AuthMiddleware] Permission check error');
            res.status(500).json({ error: 'Failed to verify permissions' });
        }
    };
}

module.exports = {
    authenticateToken,
    authorizeRole,
    requireRole: authorizeRole, // Alias
    requireAuth: authenticateToken, // Alias
    checkPermission,
    optionalAuth,
    invalidateAuthCache
};
