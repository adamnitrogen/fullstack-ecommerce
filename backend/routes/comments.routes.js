const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const commentService = require('../services/comment.service');
const moderationService = require('../services/moderation.service');
const { authenticateToken, optionalAuth } = require('../middleware/auth.middleware');
const { checkCommentRateLimit } = require('../middleware/rateLimit.middleware');
const { validateCommentInput, validateFlagInput } = require('../middleware/validation.middleware');
const { requireAdminOrManager } = require('../middleware/adminOnly.middleware');

// --- Public / Authenticated User Routes ---

// Get comments for a blog post
router.get('/:blogId', optionalAuth, async (req, res) => {
    try {
        const { blogId } = req.params;
        const { page, limit, sortBy } = req.query;

        const result = await commentService.getComments(
            blogId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
            sortBy
        );

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching comments:');
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Create a new comment
router.post('/',
    authenticateToken,
    validateCommentInput,
    checkCommentRateLimit,
    async (req, res) => {
        try {
            const { blogId, content, parentId } = req.body;
            const userId = req.user.userId;

            const comment = await commentService.createComment(userId, blogId, content, parentId);
            res.status(201).json(comment);
        } catch (error) {
            logger.error({ err: error }, 'Error creating comment:');
            res.status(500).json({ error: 'Failed to create comment' });
        }
    }
);

// Update a comment
router.put('/:id', authenticateToken, validateCommentInput, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.userId;

        const comment = await commentService.updateComment(id, userId, content);
        res.json(comment);
    } catch (error) {
        logger.error({ err: error }, 'Error updating comment:');
        if (error.message.includes('Unauthorized')) {
            return res.status(403).json({ error: error.message });
        }
        if (error.message.includes('Time limit')) {
            return res.status(403).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Delete a comment (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;

        const comment = await commentService.deleteComment(id, userId, userRole);
        res.json({ message: 'Comment deleted successfully', comment });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting comment:');
        if (error.message.includes('Unauthorized')) {
            return res.status(403).json({ error: 'Unauthorized to delete this comment' });
        }
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Flag a comment
router.post('/:id/flag', authenticateToken, validateFlagInput, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, details } = req.body;
        const userId = req.user.userId;

        const flag = await commentService.flagComment(id, userId, reason, details);
        res.status(201).json({ message: 'Comment flagged successfully', flag });
    } catch (error) {
        logger.error({ err: error }, 'Error flagging comment:');
        if (error.message.includes('already flagged')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to flag comment' });
    }
});

// --- Admin / Manager Routes ---

// Get flagged comments
router.get('/admin/flagged', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { page, limit, status } = req.query;
        const result = await moderationService.getFlaggedComments(
            parseInt(page) || 1,
            parseInt(limit) || 20,
            status
        );
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching flagged comments:');
        res.status(500).json({ error: 'Failed to fetch flagged comments' });
    }
});

// Approve a comment (unflag)
router.post('/:id/approve', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;

        const comment = await moderationService.approveComment(id, adminId);
        res.json({ message: 'Comment approved', comment });
    } catch (error) {
        logger.error({ err: error }, 'Error approving comment:');
        res.status(500).json({ error: 'Failed to approve comment' });
    }
});

// Hide a comment
router.post('/:id/hide', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;

        const comment = await moderationService.hideComment(id, adminId);
        res.json({ message: 'Comment hidden', comment });
    } catch (error) {
        logger.error({ err: error }, 'Error hiding comment:');
        res.status(500).json({ error: 'Failed to hide comment' });
    }
});

// Restore a comment
router.post('/:id/restore', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;

        const comment = await moderationService.restoreComment(id, adminId);
        res.json({ message: 'Comment restored', comment });
    } catch (error) {
        logger.error({ err: error }, 'Error restoring comment:');
        res.status(500).json({ error: 'Failed to restore comment' });
    }
});

// Permanently delete a comment
router.delete('/:id/permanent', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;

        await moderationService.deleteCommentPermanently(id, adminId);
        res.json({ message: 'Comment permanently deleted' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting comment permanently:');
        res.status(500).json({ error: 'Failed to delete comment permanently' });
    }
});

// Get moderation history
router.get('/:id/history', authenticateToken, requireAdminOrManager, async (req, res) => {
    try {
        const { id } = req.params;
        const history = await moderationService.getModerationHistory(id);
        res.json(history);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching moderation history:');
        res.status(500).json({ error: 'Failed to fetch moderation history' });
    }
});

module.exports = router;
