/**
 * i18n Language Detection Middleware
 * Determines the target language for the request.
 * Priority: Query Param > Header > User Profile > Default (en)
 */
const i18nMiddleware = (req, res, next) => {
    // 1. Check Query Parameter (?lang=hi)
    let lang = req.query.lang;

    // 2. Check Header (x-user-lang: hi)
    if (!lang) {
        lang = req.headers['x-user-lang'];
    }

    // 3. Check User Profile (if authenticated)
    if (!lang && req.user && req.user.preferred_language) {
        lang = req.user.preferred_language;
    }

    // 4. Fallback to English
    if (!lang || !['en', 'hi'].includes(lang)) {
        lang = 'en';
    }

    // Attach to request object for use in controllers/services
    req.language = lang;

    // Also set as a global context if needed or pass down explicitly
    next();
};

module.exports = i18nMiddleware;
