const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { z } = require('zod');
const { authenticateToken, invalidateAuthCache, optionalAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { loginSchema, registerSchema, changePasswordSchema } = require('../schemas/auth.schema');
const AuthService = require('../services/auth.service');
const supabase = require('../config/supabase'); // Still needed for some inline logic if any

/**
 * GET /auth/me
 * Get current authenticated user from JWT cookie
 */
router.get('/me', optionalAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        if (!req.user) {
            return res.json({ success: true, user: null });
        }
        const user = await AuthService.getUserProfile(req.user.userId);
        res.json({ success: true, user });
    } catch (error) {
        logger.error({ err: error }, 'Get current user error');
        res.status(error.status || 500).json({ error: error.message });
    }
});

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

    try {
        await AuthService.syncSession(access_token);

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000, // 15 mins
            path: '/'
        });

        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/'
        });

        res.json({ success: true, message: 'Session synced' });

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

    try {
        const otpResult = await AuthService.validateCredentials(email, password);

        if (!otpResult.success) {
            return res.status(otpResult.retryAfter ? 429 : 400).json(otpResult);
        }

        res.json({
            success: true,
            message: 'Credentials validated. OTP sent to your email.',
            expiresIn: otpResult.expiresIn,
            attemptsAllowed: otpResult.attemptsAllowed
        });
    } catch (error) {
        logger.error({ err: error }, 'Validate credentials error');
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * POST /auth/register
 * Complete registration after OTP verification
 */
router.post('/register', validate(registerSchema), async (req, res) => {
    try {
        const user = await AuthService.registerUser({
            ...req.body,
            isOtpVerified: req.body.otpVerified === true
        });

        res.status(201).json({
            success: true,
            message: "Registration successful. Please check your email to verify your account.",
            user
        });
    } catch (error) {
        logger.error({ err: error }, 'Registration error');
        res.status(error.status || 500).json({ error: error.message });
    }
});

/**
 * GET /auth/verify-email
 */
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    try {
        await AuthService.verifyEmail(token);

        res.json({
            success: true,
            message: 'Email verified successfully! You can now log in.'
        });
    } catch (error) {
        logger.error({ err: error }, 'Email verification error');
        res.status(error.status || 500).json({ error: error.message });
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

        res.cookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/'
        });

        res.cookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        res.json({
            success: true,
            message: 'Logged in successfully',
            user,
            tokens
        });
    } catch (error) {
        logger.error({ err: error }, 'Verify Login OTP error');
        res.status(error.status || 400).json({ error: error.message, attemptsRemaining: error.attemptsRemaining });
    }
});



/**
 * POST /auth/refresh
 */
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }

    try {
        const tokens = await AuthService.refreshToken(refreshToken);

        res.cookie('access_token', tokens.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/'
        });

        res.cookie('refresh_token', tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        res.json({ success: true, message: 'Token refreshed', tokens });

    } catch (error) {
        logger.error({ err: error.message, stack: error.stack }, 'Refresh token error');

        // Define cookie options for clearing
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
            sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
            path: '/'
        };

        // ONLY clear cookies if the error is definitely an auth failure (4xx)
        // If it's a 5xx (Supabase down, network error), let the user keep their cookies and try again later.
        const isAuthError = error.status && error.status >= 400 && error.status < 500;

        if (isAuthError) {
            logger.warn('[AuthRoutes] Clearing cookies due to definitive auth failure during refresh');
            res.clearCookie('access_token', cookieOptions);
            res.clearCookie('refresh_token', cookieOptions);
            return res.status(error.status).json({ error: error.message });
        }

        res.status(error.status || 500).json({
            error: 'Failed to refresh token',
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

    // Define cookie options for clearing (must match setting exactly + maxAge 0)
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https'),
        sameSite: (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https')) ? 'none' : 'lax',
        path: '/'
    };

    const expiredOptions = {
        ...cookieOptions,
        maxAge: 0,
        expires: new Date(0)
    };

    const clearCookies = (response) => {
        response.cookie('access_token', '', expiredOptions);
        response.cookie('refresh_token', '', expiredOptions);
        response.clearCookie('access_token', cookieOptions);
        response.clearCookie('refresh_token', cookieOptions);
    };

    try {
        await AuthService.logout(accessToken, refreshToken);
        clearCookies(res);
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Logout error:');
        clearCookies(res);
        res.json({ success: true, message: 'Logged out successfully' });
    }
});

/**
 * POST /auth/change-password
 */
router.post('/change-password', authenticateToken, validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: req.user.email,
            password: currentPassword
        });

        if (signInError) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(
            req.user.id,
            { password: newPassword }
        );

        if (updateError) {
            throw updateError;
        }

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        logger.error({ err: error }, 'Change password error:');
        res.status(500).json({ error: 'Failed to update password' });
    }
});

module.exports = router;
