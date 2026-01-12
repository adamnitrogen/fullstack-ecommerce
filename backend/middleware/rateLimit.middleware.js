const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Middleware to check comment rate limits using database function
 * Enforces 5 comments per 5 minutes per user per blog
 */
const checkCommentRateLimit = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { blogId } = req.body;

        // Skip rate limit for admins/managers
        if (req.user?.role === 'admin' || req.user?.role === 'manager') {
            return next();
        }

        if (!userId || !blogId) {
            // If missing data, let validation middleware handle it or proceed
            return next();
        }

        // Call database function to check limit
        const { data, error } = await supabase
            .rpc('check_comment_rate_limit', {
                p_user_id: userId,
                p_blog_id: blogId,
                p_max_comments: 5
            });

        if (error) {
            logger.error('Rate limit check error:', error);
            // Fail open (allow comment) if DB check fails, but log it
            return next();
        }

        // data is an array of objects from RPC
        const result = data[0];

        if (result && !result.is_allowed) {
            const resetTime = new Date(result.window_resets_at);
            const minutesLeft = Math.ceil((resetTime - new Date()) / 60000);

            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: `You are posting too fast. Please wait ${minutesLeft} minutes before posting again.`,
                retryAfter: result.window_resets_at
            });
        }

        // Attach rate limit info to request for use in controller
        req.rateLimitInfo = result;
        next();

    } catch (err) {
        logger.error('Rate limit middleware error:', err);
        next();
    }
};

module.exports = {
    checkCommentRateLimit
};
