const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const {
    getAdminNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    archiveNotification
} = require('../services/admin-notification.service');

/**
 * Admin Notification Routes
 * Handle order notifications for admin users
 */

// Helper to get user ID
const getUserId = (req) => {
    return req.user?.id || req.headers['x-user-id'];
};

// Get admin notifications
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { status } = req.query;
        const filters = status ? { status } : {};

        const notifications = await getAdminNotifications(userId, filters);
        res.json(notifications);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching notifications:');
        res.status(500).json({ error: error.message });
    }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const count = await getUnreadCount(userId);
        res.json({ count });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching unread count:');
        res.status(500).json({ error: error.message });
    }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const notification = await markAsRead(req.params.id, userId);
        res.json(notification);
    } catch (error) {
        logger.error({ err: error }, 'Error marking notification as read:');
        res.status(500).json({ error: error.message });
    }
});

// Mark all as read
router.put('/read-all', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const notifications = await markAllAsRead(userId);
        res.json({ count: notifications.length });
    } catch (error) {
        logger.error({ err: error }, 'Error marking all as read:');
        res.status(500).json({ error: error.message });
    }
});

// Archive notification
router.put('/:id/archive', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const notification = await archiveNotification(req.params.id, userId);
        res.json(notification);
    } catch (error) {
        logger.error({ err: error }, 'Error archiving notification:');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
