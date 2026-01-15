const { supabaseAdmin } = require('../lib/supabase');
const logger = require('../utils/logger');
const { cleanupOrphanedUser } = require('../utils/cleanup');
const { sendOTP, verifyOTP } = require('./otp.service');
const CartService = require('./cart.service');
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
        const { data: profile, error } = await supabaseAdmin
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
            mustChangePassword: profile.must_change_password,
            authProvider: profile.auth_provider || 'LOCAL',
            deletionStatus: profile.deletion_status,
            scheduledDeletionAt: profile.scheduled_deletion_at
        };
    }

    /**
     * Check if email exists
     */
    static async checkEmailExists(email) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .eq('is_deleted', false)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    }

    /**
     * Sync Session (Exchange Token for Cookies)
     */
    static async syncSession(accessToken, guestId) {
        try {
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

            if (error || !user) {
                logger.error({ err: error }, '[AuthService] Supabase token validation failed in syncSession');
                const err = new Error('Invalid session token');
                err.status = 401;
                throw err;
            }

            // Check if profile exists and its status
            let { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('is_deleted, deletion_status, scheduled_deletion_at, auth_provider, welcome_sent')
                .eq('id', user.id)
                .single();

            if (profileError && profileError.code === '42703') {
                // FALLBACK: If welcome_sent column is missing, retry without it
                logger.warn({ userId: user.id }, '[AuthService] welcome_sent column missing, falling back to safe select');
                const fallback = await supabaseAdmin
                    .from('profiles')
                    .select('is_deleted, deletion_status, scheduled_deletion_at, auth_provider')
                    .eq('id', user.id)
                    .single();
                profile = fallback.data;
                profileError = fallback.error;
            }

            if (profileError && profileError.code !== 'PGRST116') {
                logger.error({ err: profileError, userId: user.id }, '[AuthService] Error looking up profile in syncSession');
                throw profileError;
            }

            if (!profile) {
                // Profile missing! If it's an OAuth user, create it.
                logger.info({ userId: user.id }, '[AuthService] Profile missing for user, creating new profile');

                const { data: roleData } = await supabaseAdmin
                    .from('roles')
                    .select('id')
                    .eq('name', 'customer')
                    .single();

                const name = user.user_metadata?.full_name || user.user_metadata?.name || 'User';
                const nameParts = name.trim().split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

                const { error: createError } = await supabaseAdmin
                    .from('profiles')
                    .insert({
                        id: user.id,
                        email: user.email,
                        name: name,
                        first_name: firstName,
                        last_name: lastName,
                        role_id: roleData?.id,
                        email_verified: user.email_confirmed_at != null,
                        auth_provider: user.app_metadata?.provider === 'google' ? 'GOOGLE' : 'LOCAL',
                        is_deleted: false,
                        deletion_status: 'ACTIVE',
                        welcome_sent: false // Explicitly set to false to be safe
                    });

                if (createError) {
                    logger.error({ err: createError, userId: user.id }, '[AuthService] Failed to create profile during sync');
                    const err = new Error('Failed to initialize user profile');
                    err.status = 500;
                    throw err;
                }

                // If we successfully created it here, it's definitely a new user
                this.triggerWelcomeEmail(user, name, 'new');
            } else {
                // Profile exists. Let's check if it needs refinement (e.g. if created by trigger)
                const isGoogleUser = user.app_metadata?.provider === 'google';

                // Welcome email logic check - if it's a first time OAuth sync but email never sent
                const needsInitialGoogleSync = isGoogleUser && profile.auth_provider === 'LOCAL' && !profile.is_deleted;
                // CRITICAL: Only trigger if strictly false. If undefined (column missing), skip to avoid spam.
                const needsWelcomeEmail = profile.welcome_sent === false && !profile.is_deleted;

                if (needsInitialGoogleSync || needsWelcomeEmail) {
                    logger.info({ userId: user.id, needsInitialGoogleSync, needsWelcomeEmail }, '[AuthService] Profile needs sync or welcome email');

                    const name = user.user_metadata?.full_name || user.user_metadata?.name || 'User';
                    const nameParts = name.trim().split(' ');
                    const firstName = nameParts[0];
                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            name: name,
                            first_name: firstName,
                            last_name: lastName,
                            auth_provider: 'GOOGLE',
                            email_verified: user.email_confirmed_at != null
                        })
                        .eq('id', user.id);

                    // Trigger Welcome Email for this first-time Google sync
                    this.triggerWelcomeEmail(user, name, 'new_sync');
                } else if (needsWelcomeEmail) {
                    this.triggerWelcomeEmail(user, null, 'catch_up');
                } else if (profile?.is_deleted || profile?.deletion_status === 'DELETION_IN_PROGRESS') {
                    // ... (rest of the reactivation logic)
                    logger.info({ userId: user.id }, '[AuthService] Reactivating deleted profile during sync');

                    // Reactivate the profile
                    const { error: reactivateError } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            email: user.email, // Restore email if it was anonymized
                            is_deleted: false,
                            deletion_status: 'ACTIVE',
                            deleted_at: null,
                            // Ensure provider is recorded correctly
                            auth_provider: user.app_metadata?.provider === 'google' ? 'GOOGLE' : profile.auth_provider || 'LOCAL'
                        })
                        .eq('id', user.id);

                    if (reactivateError) {
                        logger.error({ err: reactivateError, userId: user.id }, '[AuthService] Failed to reactivate profile');
                        const err = new Error('Failed to reactivate account');
                        err.status = 500;
                        throw err;
                    }

                    // Send Welcome Email for reactivated users in background
                    if (!profile.welcome_sent) {
                        this.triggerWelcomeEmail(user, null, 'reactivation');
                    }

                    // Cancel any active deletion jobs for this user (FIRE AND FORGET)
                    supabaseAdmin
                        .from('account_deletion_jobs')
                        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
                        .eq('user_id', user.id)
                        .in('status', ['PENDING', 'IN_PROGRESS'])
                        .then(({ error }) => {
                            if (error) logger.warn({ err: error, userId: user.id }, '[AuthService] Failed to cancel deletion jobs in background');
                        })
                        .catch(err => logger.warn({ err, userId: user.id }, '[AuthService] Error in background deletion job cancellation'));
                }
            }

            // Merge Guest Cart if present
            if (guestId) {
                CartService.mergeGuestCart(user.id, guestId)
                    .catch(err => logger.error({ err }, 'Background cart merge failed during sync'));
            }

            logger.info({ userId: user.id }, '[AuthService] syncSession nearly complete, fetching final profile');
            // Return full user profile for consistency
            return await this.getUserProfile(user.id);
        } catch (error) {
            if (error.status) throw error;
            logger.error({ err: error }, '[AuthService] Unexpected error in syncSession');
            const err = new Error(error.message || 'Session synchronization failed');
            err.status = 500;
            throw err;
        }
    }

    /**
     * Helper to trigger welcome emails safely and update the welcome_sent flag
     */
    static async triggerWelcomeEmail(user, name, source) {
        try {
            // First check if already sent - belt and suspenders
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('welcome_sent, name, email')
                .eq('id', user.id)
                .single();

            if (profileError) {
                logger.warn({ err: profileError, userId: user.id, source }, '[AuthService] Profile lookup failed in triggerWelcomeEmail');
                // If the column doesn't exist yet, we don't want to crash. 
                // But we also don't want to spam if it's a real error.
                if (profileError.code !== '42703') {
                    return;
                }
            }

            if (profile?.welcome_sent !== false) {
                // If true, we already sent it. 
                // If undefined, either the user is missing or the column is missing (migration not run).
                // In either case, we should skip to avoid spam or errors.
                if (profile?.welcome_sent === true) {
                    logger.info({ userId: user.id, source }, '[AuthService] Welcome email already sent, skipping');
                } else {
                    logger.info({ userId: user.id, source }, '[AuthService] Welcome email skipped (already sent or tracking column missing)');
                }
                return;
            }

            const emailService = require('./email');
            const finalName = name || profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || 'User';

            logger.info({ userId: user.id, email: user.email, name: finalName, source }, '[AuthService] Triggering welcome email');

            // Send email
            await emailService.sendRegistrationEmail(user.email, { name: finalName, email: user.email });

            // Update database flag
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ welcome_sent: true })
                .eq('id', user.id);

            if (updateError) {
                logger.error({ err: updateError, userId: user.id }, '[AuthService] Failed to update welcome_sent flag after sending email');
            }
        } catch (eErr) {
            logger.error({ err: eErr, userId: user.id, source }, '[AuthService] Error in triggerWelcomeEmail');
        }
    }

    /**
     * Validate Credentials & Send OTP (Step 1 of Login)
     */
    static async validateCredentials(email, password, guestId) {
        // Create a temporary client to validate credentials without tainting the global instance
        const { createClient } = require('@supabase/supabase-js');
        const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false,
                detectSessionInUrl: false
            }
        });

        // Run profile check and auth sign-in in parallel
        const [profileResponse, authResponse] = await Promise.all([
            supabaseAdmin
                .from('profiles')
                .select('id, email, is_blocked, is_deleted')
                .eq('email', email)
                .single(),
            tempClient.auth.signInWithPassword({
                email,
                password
            })
        ]);

        const { data: profile, error: profileError } = profileResponse;
        const { data: { user, session } = {}, error: authError } = authResponse;

        if (profileError || !profile) {
            return { success: false, error: 'Account does not exist with this email ID', status: 404 };
        }

        if (profile.is_deleted) {
            return {
                success: false,
                error: 'This account has been deleted. If you wish to use our services again, please create a new account.',
                status: 403
            };
        }

        if (profile.is_blocked) {
            return { success: false, error: 'Account is blocked. Please contact support.', status: 403 };
        }

        if (authError || !session) {
            return { success: false, error: 'Invalid password', status: 401 };
        }

        // Encrypt tokens
        const tokens = {
            access_token: session.access_token,
            refresh_token: session.refresh_token
        };
        const encryptedTokens = encryptTokens(tokens);

        // Send OTP with encrypted tokens as metadata
        // Pass guestId in metadata so it can be retrieved during verification
        return await sendOTP(email, { tokens: encryptedTokens, guestId });
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
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*, roles(name)')
            .eq('email', email)
            .single();

        if (profileError || !profile) {
            throw new Error('User profile not found');
        }

        // 5. Merge Guest Cart if guestId provided
        if (otpResult.metadata?.guestId) {
            // Fire and forget merge
            CartService.mergeGuestCart(profile.id, otpResult.metadata.guestId)
                .catch(err => logger.error({ err }, 'Background cart merge failed'));
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
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, is_deleted')
            .eq('email', email)
            .eq('is_deleted', false)
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
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: isOtpVerified,
            user_metadata: { name, phone: phone || null }
        });

        if (authError) throw authError;

        // 2. Get Role
        const { data: roleData } = await supabaseAdmin
            .from('roles')
            .select('id')
            .eq('name', 'customer')
            .single();

        // 3. Create Profile
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

        const { error: profileError } = await supabaseAdmin
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
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw new Error('Failed to create/update profile');
        }

        // 4. Verification Token
        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await supabaseAdmin
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

        let { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, welcome_sent, email_verification_token, email_verification_expires')
            .eq('email_verification_token', token)
            .single();

        if (findError && findError.code === '42703') {
            // FALLBACK: retry without welcome_sent
            const fallback = await supabaseAdmin
                .from('profiles')
                .select('id, email, name, email_verification_token, email_verification_expires')
                .eq('email_verification_token', token)
                .single();
            profile = fallback.data;
            findError = fallback.error;
        }

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

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                email_verified: true,
                email_verification_token: null,
                email_verification_expires: null
            })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        // Send Welcome Email after first verification, using triggerWelcomeEmail for consistency/flag logic
        const mockUser = { id: profile.id, email: profile.email };
        this.triggerWelcomeEmail(mockUser, profile.name, 'verify_email');

        await supabaseAdmin.auth.admin.updateUserById(profile.id, {
            email_confirm: true
        });

        logger.info({ userId: profile.id }, 'Email verified successfully');
        return true;
    }

    /**
     * Refresh Token
     * 
     * CRITICAL: This method handles session persistence when access token expires.
     * Called when frontend interceptor catches 401 and attempts refresh.
     * Returns: new tokens + userId for fetching user profile
     * 
     * Flow:
     * 1. Access token expired → frontend gets 401
     * 2. Interceptor calls /auth/refresh with refresh_token cookie
     * 3. This method uses Supabase to get new session
     * 4. Route sets new cookies and returns user data
     * 5. User remains logged in seamlessly
     */
    static async refreshToken(oldRefreshToken) {
        if (!oldRefreshToken) {
            // WHY: No refresh token = user never logged in or cookies were cleared
            const error = new Error('Refresh token required');
            error.status = 401;
            throw error;
        }

        const { data: { session }, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: oldRefreshToken });

        if (error || !session) {
            // WHY: Refresh token expired or revoked - user must re-login
            logger.warn({ err: error?.message }, '[AuthService] Supabase refreshSession failed');
            const err = new Error(error?.message || 'Invalid or expired refresh token');
            err.status = error?.status || 401;
            throw err;
        }

        return {
            tokens: {
                access_token: session.access_token,
                refresh_token: session.refresh_token
            },
            userId: session.user.id
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
                await supabaseAdmin.auth.admin.signOut(accessToken);
            } catch (ignore) {
                // Ignore if already invalid
            }
        }

        return true;
    }

    /**
     * Request Password Reset
     * Generates a reset token and sends email
     * Returns true always (security: don't reveal if email exists)
     */
    static async requestPasswordReset(email) {
        // Find user by email
        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, is_deleted, is_blocked')
            .eq('email', email.toLowerCase().trim())
            .single();

        // Security: Always return success to prevent email enumeration
        if (findError || !profile) {
            const error = new Error('Account does not exist with this email ID');
            error.status = 404;
            throw error;
        }

        if (profile.is_deleted) {
            const error = new Error('This account has been deleted. Please create a new account.');
            error.status = 403;
            throw error;
        }

        if (profile.is_blocked) {
            const error = new Error('Account is blocked. Please contact support.');
            error.status = 403;
            throw error;
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store token in database
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                password_reset_token: resetToken,
                password_reset_expires: tokenExpiry.toISOString()
            })
            .eq('id', profile.id);

        if (updateError) {
            logger.error({ err: updateError }, 'Failed to store password reset token');
            throw new Error('Failed to initiate password reset');
        }

        // Send reset email
        const emailService = require('./email');
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

        // Don't await - send async
        emailService.sendPasswordResetEmail(profile.email, resetLink).catch(err =>
            logger.error({ err }, 'Failed to send password reset email')
        );

        logger.info({ userId: profile.id }, 'Password reset token generated');
        return { success: true, message: 'If an account exists, a reset email will be sent.' };
    }

    /**
     * Validate Reset Token
     * Checks if token is valid and not expired
     */
    static async validateResetToken(token) {
        if (!token) {
            const error = new Error('Reset token required');
            error.status = 400;
            throw error;
        }

        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, password_reset_token, password_reset_expires')
            .eq('password_reset_token', token)
            .single();

        if (findError || !profile) {
            const error = new Error('Invalid or expired reset link');
            error.status = 400;
            throw error;
        }

        if (new Date(profile.password_reset_expires) < new Date()) {
            const error = new Error('Reset link has expired. Please request a new one.');
            error.status = 400;
            throw error;
        }

        return { valid: true, email: profile.email };
    }

    /**
     * Reset Password
     * Sets a new password using the reset token
     * Invalidates all sessions and changes auth_provider to LOCAL
     */
    static async resetPassword(token, newPassword) {
        // Validate token first
        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, password_reset_token, password_reset_expires, auth_provider, is_deleted, is_blocked')
            .eq('password_reset_token', token)
            .single();

        if (findError || !profile) {
            const error = new Error('Invalid or expired reset link');
            error.status = 400;
            throw error;
        }

        if (profile.is_deleted) {
            const error = new Error('This account has been deleted.');
            error.status = 403;
            throw error;
        }

        if (profile.is_blocked) {
            const error = new Error('Account is blocked. Please contact support.');
            error.status = 403;
            throw error;
        }

        if (new Date(profile.password_reset_expires) < new Date()) {
            const error = new Error('Reset link has expired. Please request a new one.');
            error.status = 400;
            throw error;
        }

        // Update password in Supabase Auth
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            profile.id,
            { password: newPassword }
        );

        if (authError) {
            logger.error({ err: authError }, 'Failed to update password in auth');
            throw new Error('Failed to reset password');
        }

        // Clear token and update auth_provider to LOCAL
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                password_reset_token: null,
                password_reset_expires: null,
                auth_provider: 'LOCAL', // User now has a password
                must_change_password: false
            })
            .eq('id', profile.id);

        if (updateError) {
            logger.error({ err: updateError }, 'Failed to clear reset token');
        }

        // Invalidate all sessions for this user
        try {
            // Sign out user from all sessions
            await supabaseAdmin.auth.admin.signOut(profile.id, 'global');
        } catch (signOutError) {
            logger.warn({ err: signOutError }, 'Failed to sign out user after password reset');
        }

        logger.info({ userId: profile.id, wasGoogleUser: profile.auth_provider === 'GOOGLE' },
            'Password reset completed successfully');

        return { success: true, message: 'Password reset successful. Please log in with your new password.' };
    }

    /**
     * Send Email Verification for Google Users
     * Generates a new verification token and sends email
     * Only works for Google auth users with unverified email
     */
    static async sendGoogleUserVerificationEmail(userId) {
        const { data: profile, error: findError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, email_verified, auth_provider')
            .eq('id', userId)
            .single();

        if (findError || !profile) {
            const error = new Error('User not found');
            error.status = 404;
            throw error;
        }

        // Only allow for Google auth users with unverified email
        if (profile.auth_provider !== 'GOOGLE') {
            const error = new Error('Email verification is only available for Google sign-in accounts');
            error.status = 400;
            throw error;
        }

        if (profile.email_verified) {
            const error = new Error('Email is already verified');
            error.status = 400;
            throw error;
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                email_verification_token: verificationToken,
                email_verification_expires: tokenExpiry.toISOString()
            })
            .eq('id', profile.id);

        if (updateError) {
            logger.error({ err: updateError }, 'Failed to store verification token');
            throw new Error('Failed to send verification email');
        }

        // Send verification email
        const emailService = require('./email');
        const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

        await emailService.sendEmailConfirmation(profile.email, {
            name: profile.name,
            email: profile.email,
            verificationLink
        }, profile.id);

        logger.info({ userId: profile.id }, 'Verification email sent to Google user');
        return { success: true, message: 'Verification email sent. Link valid for 24 hours.' };
    }

    /**
     * Resend Confirmation Email (Standard Signup)
     * Checks if user is already verified
     */
    static async resendConfirmationEmail(email) {
        // 1. Get user profile
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('id, is_deleted, auth_provider')
            .eq('email', email)
            .single();

        if (error || !profile) {
            // Be vague for security, or specific if user wants UX over security enumeration
            // Given the requirement is UX, we'll suggest creating an account
            const err = new Error('Account not found with this email');
            err.status = 404;
            throw err;
        }

        if (profile.is_deleted) {
            const err = new Error('Account deleted. Please create a new account.');
            err.status = 403;
            throw err;
        }

        if (profile.auth_provider === 'GOOGLE') {
            // For Google users, use the specific Google verification flow if needed,
            // or tell them to Login with Google.
            // Usually Google users are auto-verified.
            const err = new Error('This account uses Google Sign-In. Please log in with Google.');
            err.status = 400;
            throw err;
        }

        // 2. Check Supabase Auth User Status
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

        if (userError || !user) {
            const err = new Error('User data not found');
            err.status = 404;
            throw err;
        }

        if (user.email_confirmed_at) {
            const err = new Error('Email is already verified. Please log in.');
            err.status = 400;
            throw err; // This is the key change for the user request
        }

        // 3. Resend Confirmation
        const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`
            }
        });

        if (resendError) {
            logger.error({ err: resendError }, 'Supabase resend failed');
            throw new Error(resendError.message);
        }

        return { success: true, message: 'Confirmation email sent' };
    }
}

module.exports = AuthService;
