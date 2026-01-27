const MESSAGES = require('../config/messages');

/**
 * Middleware to ensure user has admin or manager role
 */
const requireAdminOrManager = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: MESSAGES.AUTH.AUTHENTICATION_REQUIRED });
    }

    const allowedRoles = ['admin', 'manager'];

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: MESSAGES.AUTH.INSUFFICIENT_PERMISSIONS });
    }

    next();
};

module.exports = {
    requireAdminOrManager
};
