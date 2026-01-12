/**
 * Middleware to ensure user has admin or manager role
 */
const requireAdminOrManager = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedRoles = ['admin', 'manager'];

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions. Admin or Manager role required.' });
    }

    next();
};

module.exports = {
    requireAdminOrManager
};
