const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { z } = require('zod');
const { authenticateToken, invalidateAuthCache, optionalAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { loginSchema, registerSchema, changePasswordSchema } = require('../schemas/auth.schema');
const AuthService = require('../services/auth.service');
const { supabase, supabaseAdmin } = require('../lib/supabase'); // Consolidated Supabase client usage
const { createClient } = require('@supabase/supabase-js');
const { getFriendlyMessage, getI18nKey } = require('../utils/error-messages');

// NOTE: /auth/me endpoint REMOVED
// Session initialization now uses supabase.auth.getSession() on frontend
// /auth/refresh returns user data for state sync after token refresh

/**
 * POST /auth/check-email
 * Check if email exists in the system
 */
router.post('/check-email', validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;
    try {
        const exists = await AuthService.checkEmailExists(email);
        res.json({ exists, email });
    } catch (error) {
        logger.error({ err: error }, 'Check email error');
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * POST /auth/sync
 * Sync Supabase Session (e.g. from Google OAuth) with Backend Cookies
 */
router.post('/sync', validate(z.object({ access_token: z.string(), refresh_token: z.string() })), async (req, res) => {
    const { access_token, refresh_token } = req.body;
    const guestId = req.headers['x-guest-id'];
    logger.info({ email: req.body.email }, '[AuthRoutes] Received sync request');

    try {
        const user = await AuthService.syncSession(access_token, guestId);

        const isProd = process.env.NODE_ENV === 'production';
        const isHttps = process.env.FRONTEND_URL?.startsWith('https');
        const sameSiteNone = isProd && isHttps;

        const baseOptions = {
            httpOnly: true,
            secure: sameSiteNone,
            sameSite: sameSiteNone ? 'none' : 'lax',
            path: '/'
        };

        res.cookie('access_token', access_token, {
            ...baseOptions,
            maxAge: 15 * 60 * 1000 // 15 mins
        });

        res.cookie('refresh_token', refresh_token, {
            ...baseOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ success: true, message: getI18nKey('SESSION_SYNCED'), user });

    } catch (error) {
        logger.error({ err: error }, 'Session sync error');
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * POST /auth/validate-credentials
 * Validate email + password before sending OTP (for login flow)
 */
router.post('/validate-credentials', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const guestId = req.headers['x-guest-id'];

    try {
        const lang = req.get('x-user-lang') || 'en';
        const otpResult = await AuthService.validateCredentials(email, password, guestId, lang);

        if (!otpResult.success) {
            logger.warn({ email, guestId, otpResult }, '[AuthRoutes] Credentials validation failed');
            return res.status(otpResult.retryAfter ? 429 : 200).json(otpResult);
        }

        logger.info({ email, guestId }, '[AuthRoutes] Credentials validated, OTP sent');
        res.json({
            success: true,
            message: getI18nKey('OTP_SENT'),
            expiresIn: otpResult.expiresIn,
            attemptsAllowed: otpResult.attemptsAllowed
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, email, friendlyMessage }, 'Validate credentials error');
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

/**
 * POST /auth/resend-confirmation
 * Resend confirmation email (checks if already verified)
 */
router.post('/resend-confirmation', validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;
    try {
        const result = await AuthService.resendConfirmationEmail(email);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Resend confirmation error');
        res.status(error.status || 400).json({ error: error.message });
    }
});

/**
 * POST /auth/register
 * Complete registration after OTP verification
 */
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const lang = req.get('x-user-lang') || 'en';
        const user = await AuthService.registerUser({
            ...req.body,
            isOtpVerified: req.body.otpVerified === true,
            lang
        });

        logger.info({ userId: user.id }, '[AuthRoutes] User registered successfully');
        res.status(201).json({
            success: true,
            message: getI18nKey('REGISTER_SUCCESS'),
            user
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, email: req.body.email, friendlyMessage }, 'Registration error');
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

/**
 * GET /auth/verify-email
 */
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    try {
        await AuthService.verifyEmail(token);

        logger.info({ token: token ? `${token.substring(0, 5)}...` : 'null' }, '[AuthRoutes] Email verified successfully');
        res.json({
            success: true,
            message: getI18nKey('EMAIL_VERIFIED')
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, friendlyMessage }, 'Email verification error');
        res.status(error.status || 500).json({ error: friendlyMessage });
    }
});

/**
 * POST /auth/verify-login-otp
 * Verify OTP and exchange for session cookies
 */
router.post('/verify-login-otp', validate(z.object({ email: z.string().email(), otp: z.string() })), async (req, res) => {
    const { email, otp } = req.body;

    try {
        const { user, tokens } = await AuthService.verifyLoginOtp(email, otp);

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/'
        };

        res.cookie('access_token', tokens.access_token, cookieOptions);

        res.cookie('refresh_token', tokens.refresh_token, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        logger.info({ email, userId: user.id }, '[AuthRoutes] Login OTP verified successfully');
        res.json({
            success: true,
            message: getI18nKey('LOGIN_SUCCESS'),
            user,
            tokens
        });
    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, email, friendlyMessage }, 'Verify Login OTP error');
        res.status(error.status || 400).json({ error: friendlyMessage, attemptsRemaining: error.attemptsRemaining });
    }
});



/**
 * POST /auth/refresh
 * Refresh access token using refresh token from cookies
 * Returns new tokens AND user data for frontend state sync
 */
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: getI18nKey('REFRESH_TOKEN_REQUIRED') });
    }

    // Helper to get consistent cookie options
    const getCookieOptions = (isRefresh = false) => {
        const isProd = process.env.NODE_ENV === 'production';
        const isHttps = process.env.FRONTEND_URL?.startsWith('https');
        const sameSiteNone = isProd && isHttps;

        return {
            httpOnly: true,
            secure: sameSiteNone, // Only secure if using sameSite: none
            sameSite: sameSiteNone ? 'none' : 'lax',
            maxAge: isRefresh ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000,
            path: '/'
        };
    };

    try {
        // Get new tokens from Supabase
        const { tokens, userId } = await AuthService.refreshToken(refreshToken);

        // Get user profile for frontend state sync
        const user = await AuthService.getUserProfile(userId);

        const cookieOptions = getCookieOptions(false);
        const refreshOptions = getCookieOptions(true);

        res.cookie('access_token', tokens.access_token, cookieOptions);
        res.cookie('refresh_token', tokens.refresh_token, refreshOptions);

        // Return user data along with tokens for frontend state sync
        res.json({ success: true, message: getI18nKey('TOKEN_REFRESHED'), user, tokens });

    } catch (error) {
        logger.error({ err: error.message, stack: error.stack }, 'Refresh token error');

        // Clear cookies with SAME options used to set them
        const cookieOptions = getCookieOptions(false);

        // ONLY clear cookies if the error is definitely an auth failure (4xx)
        // If it's a 5xx (Supabase down, network error), let the user keep their cookies and try again later.
        const isAuthError = error.status && error.status >= 400 && error.status < 500;

        if (isAuthError) {
            logger.warn('[AuthRoutes] Clearing cookies due to definitive auth failure during refresh');
            const { maxAge, ...clearOptions } = cookieOptions;
            res.clearCookie('access_token', clearOptions);
            res.clearCookie('refresh_token', clearOptions);
        }

        res.status(error.status || 500).json({
            error: getI18nKey('INTERNAL_ERROR'),
            detailed: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /auth/logout
 */
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;
    const accessToken = req.cookies?.access_token;

    const getCookieOptions = (isRefresh = false) => {
        const isProd = process.env.NODE_ENV === 'production';
        const isHttps = process.env.FRONTEND_URL?.startsWith('https');
        const sameSiteNone = isProd && isHttps;

        return {
            httpOnly: true,
            secure: sameSiteNone,
            sameSite: sameSiteNone ? 'none' : 'lax',
            path: '/'
        };
    };

    const cookieOptions = getCookieOptions(false);
    const refreshOptions = getCookieOptions(true);

    const clearCookies = (response) => {
        const { maxAge: _a, ...accessClearOptions } = cookieOptions;
        const { maxAge: _r, ...refreshClearOptions } = refreshOptions;
        response.clearCookie('access_token', accessClearOptions);
        response.clearCookie('refresh_token', refreshClearOptions);
    };

    try {
        await AuthService.logout(accessToken, refreshToken);
        clearCookies(res);
        logger.info({ userId: req.user?.id }, '[AuthRoutes] User logged out successfully');
        res.json({ success: true, message: getI18nKey('LOGOUT_SUCCESS') });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Logout error:');
        clearCookies(res);
        res.json({ success: true, message: getI18nKey('LOGOUT_SUCCESS') });
    }
});

/**
 * POST /auth/change-password
 * Change password for authenticated users
 * BLOCKED for Google auth users - they must use reset password flow
 */
router.post('/change-password', authenticateToken, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        // Check if user is Google auth - block password change
        const { data: profile } = await supabase
            .from('profiles')
            .select('auth_provider')
            .eq('id', req.user.id)
            .single();

        if (profile?.auth_provider === 'GOOGLE') {
            return res.status(403).json({
                error: getI18nKey('GOOGLE_AUTH_BLOCKED')
            });
        }

        // Use temporary client to validate password to avoid tainting global instance
        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false,
                detectSessionInUrl: false
            }
        });

        const { error: signInError } = await tempClient.auth.signInWithPassword({
            email: req.user.email,
            password: currentPassword
        });

        if (signInError) {
            return res.status(401).json({ error: getI18nKey('INVALID_PASSWORD') });
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(
            req.user.id,
            { password: newPassword }
        );

        if (updateError) {
            throw updateError;
        }

        logger.info({ userId: req.user.id }, '[AuthRoutes] Password updated successfully');
        res.json({
            success: true,
            message: getI18nKey('PASSWORD_UPDATED')
        });

    } catch (error) {
        const friendlyMessage = getFriendlyMessage(error);
        logger.error({ err: error, userId: req.user.id, friendlyMessage }, 'Change password error:');
        res.status(500).json({ error: friendlyMessage });
    }
});

/**
 * POST /auth/reset-password-request
 * Request a password reset email
 * Security: Always returns success (don't reveal if email exists)
 */
router.post('/reset-password-request', validate(z.object({ email: z.string().email() })), async (req, res) => {
    const { email } = req.body;

    try {
        const lang = req.get('x-user-lang') || 'en';
        const result = await AuthService.requestPasswordReset(email, lang);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Password reset request error');
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * GET /auth/validate-reset-token
 * Validate a password reset token before showing form
 */
router.get('/validate-reset-token', async (req, res) => {
    const { token } = req.query;

    try {
        const result = await AuthService.validateResetToken(token);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Token validation error');
        res.status(error.status || 400).json({ error: error.message });
    }
});

/**
 * POST /auth/reset-password
 * Reset password using a valid token
 */
const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)')
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const result = await AuthService.resetPassword(token, newPassword);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Password reset error');
        res.status(error.status || 400).json({ error: error.message });
    }
});

module.exports = router;

