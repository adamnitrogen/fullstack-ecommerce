const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// Get comments for a blog
router.get('/blog/:blogId', async (req, res) => {
    try {
        const { blogId } = req.params;

        const { data, error } = await supabase
            .from('comments')
            .select(`
        *,
        profiles:user_id (
          name,
          avatar_url
        )
      `)
            .eq('blog_id', blogId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform data to match frontend expectation
        const comments = data.map(comment => ({
            id: comment.id,
            blogId: comment.blog_id,
            userId: comment.user_id,
            userName: comment.profiles?.name || 'Anonymous',
            userAvatar: comment.profiles?.avatar_url,
            content: comment.content,
            parentId: comment.parent_id,
            isFlagged: comment.is_flagged,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at
        }));

        res.json(comments);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching comments:');
        res.status(500).json({ error: error.message });
    }
});

// Create a new comment or reply
router.post('/', async (req, res) => {
    try {
        const { blogId, userId, content, parentId } = req.body;

        if (!blogId || !userId || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('comments')
            .insert([
                {
                    blog_id: blogId,
                    user_id: userId,
                    content,
                    parent_id: parentId || null,
                    status: 'active'
                }
            ])
            .select(`
        *,
        profiles:user_id (
          name,
          avatar_url
        )
      `)
            .single();

        if (error) throw error;

        const comment = {
            id: data.id,
            blogId: data.blog_id,
            userId: data.user_id,
            userName: data.profiles?.name || 'Anonymous',
            userAvatar: data.profiles?.avatar_url,
            content: data.content,
            parentId: data.parent_id,
            isFlagged: data.is_flagged,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };

        res.status(201).json(comment);
    } catch (error) {
        logger.error({ err: error }, 'Error creating comment:');
        res.status(500).json({ error: error.message });
    }
});

// Update a comment
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const { data, error } = await supabase
            .from('comments')
            .update({
                content,
                updated_at: new Date(),
                edit_count: supabase.rpc('increment', { row_id: id }),
                last_edited_at: new Date()
            })
            .eq('id', id)
            .select(`
        *,
        profiles:user_id (
          name,
          avatar_url
        )
      `)
            .single();

        if (error) throw error;

        const comment = {
            id: data.id,
            blogId: data.blog_id,
            userId: data.user_id,
            userName: data.profiles?.name || 'Anonymous',
            userAvatar: data.profiles?.avatar_url,
            content: data.content,
            parentId: data.parent_id,
            isFlagged: data.is_flagged,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };

        res.json(comment);
    } catch (error) {
        logger.error({ err: error }, 'Error updating comment:');
        res.status(500).json({ error: error.message });
    }
});

// Delete a comment (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body; // User who is deleting

        const { error } = await supabase
            .from('comments')
            .update({
                status: 'deleted',
                deleted_at: new Date(),
                deleted_by: userId || null
            })
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting comment:');
        res.status(500).json({ error: error.message });
    }
});

// Flag a comment
router.post('/:id/flag', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, flaggedBy, details } = req.body;

        if (!reason || !flaggedBy) {
            return res.status(400).json({ error: 'Reason and flaggedBy are required' });
        }

        // Insert into comment_flags table
        // The trigger will automatically update the comments table
        const { data: flagData, error: flagError } = await supabase
            .from('comment_flags')
            .insert([
                {
                    comment_id: id,
                    flagged_by: flaggedBy,
                    reason: reason,
                    details: details || null
                }
            ])
            .select()
            .single();

        if (flagError) {
            // Check if user already flagged this comment
            if (flagError.code === '23505') { // Unique violation
                return res.status(400).json({ error: 'You have already flagged this comment' });
            }
            throw flagError;
        }

        // Get updated comment to return
        const { data, error } = await supabase
            .from('comments')
            .select(`
        *,
        profiles:user_id (
          name,
          avatar_url
        )
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        const comment = {
            id: data.id,
            blogId: data.blog_id,
            userId: data.user_id,
            userName: data.profiles?.name || 'Anonymous',
            userAvatar: data.profiles?.avatar_url,
            content: data.content,
            parentId: data.parent_id,
            isFlagged: data.is_flagged,
            flagCount: data.flag_count,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };

        res.json(comment);
    } catch (error) {
        logger.error({ err: error }, 'Error flagging comment:');
        res.status(500).json({ error: error.message });
    }
});

// Get all flagged comments (Admin/Manager only)
router.get('/flagged/all', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select(`
        *,
        profiles:user_id (
          name,
          avatar_url,
          is_blocked
        ),
        blogs:blog_id (
          title
        ),
        flagger:flagged_by (
          name
        )
      `)
            .eq('is_flagged', true)
            .eq('status', 'active')  // Only show active comments, exclude deleted/hidden
            .order('flagged_at', { ascending: false });

        if (error) throw error;

        const comments = data.map(comment => ({
            id: comment.id,
            blogId: comment.blog_id,
            blogTitle: comment.blogs?.title || 'Unknown Blog',
            userId: comment.user_id,
            userName: comment.profiles?.name || 'Anonymous',
            userAvatar: comment.profiles?.avatar_url,
            userBlocked: comment.profiles?.is_blocked || false,
            content: comment.content,
            flagReason: comment.flag_reason,
            flaggedBy: comment.flagger?.name || 'Unknown',
            flagCount: comment.flag_count || 1,
            flaggedAt: comment.flagged_at,
            createdAt: comment.created_at
        }));

        res.json(comments);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching flagged comments:');
        res.status(500).json({ error: error.message });
    }
});

// Resolve flagged comment (unflag or delete)
router.post('/:id/resolve', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { action, userId } = req.body; // 'dismiss' or 'delete', and userId for audit

        if (action === 'delete') {
            // Soft delete
            const { error } = await supabase
                .from('comments')
                .update({
                    status: 'deleted',
                    deleted_at: new Date(),
                    deleted_by: userId || null
                })
                .eq('id', id);

            if (error) throw error;
            return res.json({ message: 'Comment deleted' });
        } else if (action === 'dismiss') {
            // First, check if comment exists and get current state for logging
            const { data: currentComment, error: fetchError } = await supabase
                .from('comments')
                .select('flag_reason, flag_count, status')
                .eq('id', id)
                .maybeSingle();

            // If comment doesn't exist or is deleted, return early
            if (fetchError) throw fetchError;
            if (!currentComment) {
                return res.status(404).json({ error: 'Comment not found' });
            }
            if (currentComment.status === 'deleted') {
                return res.status(400).json({ error: 'Comment has been deleted' });
            }

            // Manually log the unflagging action if userId is provided
            if (userId) {
                await supabase
                    .from('comment_moderation_log')
                    .insert({
                        comment_id: id,
                        action: 'unflagged',
                        performed_by: userId,
                        metadata: {
                            previous_flag_reason: currentComment?.flag_reason,
                            previous_flag_count: currentComment?.flag_count || 0
                        }
                    });
            }

            // Delete all flag records for this comment
            // The trigger will automatically clear the flag data in comments table
            const { error: deleteError } = await supabase
                .from('comment_flags')
                .delete()
                .eq('comment_id', id);

            if (deleteError) throw deleteError;

            // Get updated comment to return
            const { data, error } = await supabase
                .from('comments')
                .select()
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            return res.json({ message: 'Flag dismissed', comment: data });
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Error resolving flagged comment:');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
