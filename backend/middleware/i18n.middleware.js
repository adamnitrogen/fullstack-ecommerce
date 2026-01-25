const i18next = require('i18next');
const middleware = require('i18next-http-middleware');
const Backend = require('i18next-fs-backend');
const path = require('path');

// Initialize i18next
i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
        fallbackLng: 'en',
        preload: ['en', 'hi'],
        ns: ['translation'],
        defaultNS: 'translation',
        backend: {
            loadPath: path.join(__dirname, '../../frontend/src/i18n/locales/{{lng}}.json')
        },
        detection: {
            order: ['querystring', 'header', 'cookie'],
            lookupQuerystring: 'lang',
            lookupHeader: 'x-user-lang',
            caches: false
        }
    });

/**
 * i18n Language Detection and Translation Middleware
 * Attaches the 't' function and 'language' to the request object.
 */
const i18nMiddleware = (req, res, next) => {
    // Determine language (detecting from query, header, or user profile)
    let lang = req.query.lang || req.headers['x-user-lang'];

    if (!lang && req.user && req.user.preferred_language) {
        lang = req.user.preferred_language;
    }

    if (!lang || !['en', 'hi'].includes(lang)) {
        lang = 'en';
    }

    // Set language for the current request
    req.language = lang;

    // The i18next-http-middleware handles attaching the 't' function
    // and setting the language based on detection.
    // We just need to wrap the standard next() call.
    middleware.handle(i18next)(req, res, next);
};

module.exports = i18nMiddleware;
