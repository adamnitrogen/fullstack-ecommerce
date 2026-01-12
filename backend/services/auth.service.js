const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { cleanupOrphanedUser } = require('../utils/cleanup');
const { sendOTP, verifyOTP } = require('./otp.service');
const crypto = require('crypto');

// Encryption Keys (should be in env, but generating for now or using secret)
const ENCRYPTION_KEY = process.env.JWT_SECRET || 'fallback_secret_must_be_32_bytes_long_!!'; // Ensure 32 bytes
const IV_LENGTH = 16;

function encryptTokens(tokens) {
    // Ensure key is 32 bytes
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(JSON.stringify(tokens));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptTokens(text) {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
}

class AuthService {
    /**
     * Get user profile by ID
     */
    static async getUserProfile(userId) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*, roles(name)')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            throw new Error('User not found');
        }

        return {
            id: profile.id,
            email: profile.email,
            phone: profile.phone,
            name: profile.name,
            role: profile.roles?.name || 'customer',
            emailVerified: profile.email_verified,
            phoneVerified: profile.phone_verified,
            mustChangePassword: profile.must_change_password
        };
    }

    /**
     * Check if email exists
     */
    static async checkEmailExists(email) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    }

    /**
     * Sync Session (Exchange Token for Cookies)
     */
    static async syncSession(accessToken) {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
            throw new Error('Invalid token');
        }

        return user;
    }

    /**
     * Validate Credentials & Send OTP (Step 1 of Login)
     */
    static async validateCredentials(email, password) {
        // Run profile check and auth sign-in in parallel
        const [profileResponse, authResponse] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, email, is_blocked, is_deleted')
                .eq('email', email)
                .single(),
            supabase.auth.signInWithPassword({
                email,
                password
            })
        ]);

        const { data: profile, error: profileError } = profileResponse;
        const { data: { user, session } = {}, error: authError } = authResponse;

        if (profileError || !profile) {
            throw new Error('Account does not exist with this email ID');
        }

        if (profile.is_deleted) {
            const error = new Error('This account has been deleted. If you wish to use our services again, please create a new account.');
            error.status = 403;
            throw error;
        }

        if (profile.is_blocked) {
            const error = new Error('Account is blocked. Please contact support.');
            error.status = 403;
            throw error;
        }

        if (authError || !session) {
            const error = new Error('Invalid password');
            error.status = 401;
            throw error;
        }

        // Encrypt tokens
        const tokens = {
            access_token: session.access_token,
            refresh_token: session.refresh_token
        };
        const encryptedTokens = encryptTokens(tokens);

        // Send OTP with encrypted tokens as metadata
        return await sendOTP(email, { tokens: encryptedTokens });
    }

    /**
     * Verify Login OTP & Return Tokens
     */
    static async verifyLoginOtp(email, otp) {
        // 1. Verify OTP
        const otpResult = await verifyOTP(email, otp);

        if (!otpResult.success) {
            const error = new Error(otpResult.error);
            error.status = 400;
            error.attemptsRemaining = otpResult.attemptsRemaining;
            throw error;
        }

        // 2. Extract Encrypted Tokens
        const encryptedTokens = otpResult.metadata?.tokens;
        if (!encryptedTokens) {
            throw new Error('Session expired or invalid. Please login again.');
        }

        // 3. Decrypt Tokens
        let tokens;
        try {
            tokens = decryptTokens(encryptedTokens);
        } catch (err) {
            logger.error({ err }, 'Token decryption failed');
            throw new Error('Failed to restore session. Please login again.');
        }

        // 4. Get User Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*, roles(name)')
            .eq('email', email)
            .single();

        if (profileError || !profile) {
            throw new Error('User profile not found');
        }

        return {
            user: {
                id: profile.id,
                email: profile.email,
                phone: profile.phone,
                name: profile.name,
                role: profile.roles?.name || 'customer',
                emailVerified: profile.email_verified,
                mustChangePassword: profile.must_change_password
            },
            tokens
        };
    }



    /**
     * Register User
     */
    static async registerUser({ email, password, name, phone, isOtpVerified }) {
        logger.info({ email, name, phone }, 'Registration Request Received');
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, is_deleted')
            .eq('email', email)
            .single();

        if (existingProfile) {
            if (existingProfile.is_deleted) {
                const error = new Error('This account has been deleted. Please use a different email address to create a new account.');
                error.status = 403;
                throw error;
            }
            const error = new Error('An account with this email already exists');
            error.status = 400;
            throw error;
        }

        // Cleanup orphans
        try {
            await cleanupOrphanedUser(email);
        } catch (cleanupError) {
            logger.warn({ err: cleanupError }, 'Cleanup warning');
        }

        // Validate phone number if provided
        if (phone) {
            const phoneValidator = require('../utils/phone-validator');
            logger.info({ phone }, 'Calling phone validator service from registration');
            const validationResult = await phoneValidator.validate(phone);
            if (!validationResult.isValid) {
                const error = new Error(validationResult.error);
                error.status = 400;
                throw error;
            }
        }

        // 1. Create Supabase Auth User
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: isOtpVerified,
            user_metadata: { name, phone: phone || null }
        });

        if (authError) throw authError;

        // 2. Get Role
        const { data: roleData } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'customer')
            .single();

        // 3. Create Profile
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert([{
                id: authData.user.id,
                email,
                phone: phone || null,
                name,
                first_name: firstName,
                last_name: lastName,
                role_id: roleData?.id,
                email_verified: isOtpVerified,
                phone_verified: false,
                is_deleted: false
            }], { onConflict: 'id' });

        if (profileError) {
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw new Error('Failed to create/update profile');
        }

        // 4. Verification Token
        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await supabase
            .from('profiles')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: tokenExpiry.toISOString()
            })
            .eq('id', authData.user.id);

        // 5. Send Email
        const emailService = require('./email');
        const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

        // Don't await email to speed up response
        emailService.sendEmailConfirmation(email, {
            name,
            email,
            verificationLink
        }, authData.user.id).catch(err =>
            logger.error({ err }, 'Failed to send confirmation email')
        );

        return {
            id: authData.user.id,
            email,
            phone: phone || null,
            name,
            role: 'customer',
            emailVerified: false
        };
    }
    /**
     * Verify Email Token
     */
    static async verifyEmail(token) {
        if (!token) throw new Error('Verification token required');

        const { data: profile, error: findError } = await supabase
            .from('profiles')
            .select('id, email, email_verification_token, email_verification_expires')
            .eq('email_verification_token', token)
            .single();

        if (findError || !profile) {
            const error = new Error('Invalid or expired verification link');
            error.status = 400;
            throw error;
        }

        if (new Date(profile.email_verification_expires) < new Date()) {
            const error = new Error('Verification link has expired. Please request a new one.');
            error.status = 400;
            throw error;
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                email_verified: true,
                email_verification_token: null,
                email_verification_expires: null
            })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        await supabase.auth.admin.updateUserById(profile.id, {
            email_confirm: true
        });

        logger.info({ userId: profile.id }, 'Email verified successfully');
        return true;
    }

    /**
     * Refresh Token
     */
    static async refreshToken(oldRefreshToken) {
        if (!oldRefreshToken) {
            const error = new Error('Refresh token required');
            error.status = 401;
            throw error;
        }

        const { data: { session }, error } = await supabase.auth.refreshSession({ refresh_token: oldRefreshToken });

        if (error || !session) {
            logger.warn({ err: error?.message }, '[AuthService] Supabase refreshSession failed');
            const err = new Error(error?.message || 'Invalid or expired refresh token');
            err.status = error?.status || 401;
            throw err;
        }

        return {
            access_token: session.access_token,
            refresh_token: session.refresh_token
        };
    }

    /**
     * Logout
     */
    static async logout(accessToken, refreshToken) {
        const { invalidateAuthCache } = require('../middleware/auth.middleware');

        if (accessToken) {
            // Invalidate local cache
            await invalidateAuthCache(accessToken);

            // Optional: Sign out from Supabase if we want to invalidate the session upstream
            // But we need the user token for that, and 'accessToken' is it.
            try {
                await supabase.auth.admin.signOut(accessToken);
            } catch (ignore) {
                // Ignore if already invalid
            }
        }

        return true;
    }
}

module.exports = AuthService;
