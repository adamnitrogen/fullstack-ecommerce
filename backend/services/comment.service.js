const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class CommentService {
    /**
   * Get comments for a blog post with pagination (threaded)
   */
    async getComments(blogId, page = 1, limit = 20, sortBy = 'newest') {
        const offset = (page - 1) * limit;

        logger.info({ blogId, page, limit, sortBy }, 'Service: Fetching threaded comments');

        // Call the stored procedure to get flat list of threaded comments
        const { data: flatComments, error } = await supabase
            .rpc('get_threaded_comments', {
                p_blog_id: blogId,
                p_limit: limit,
                p_offset: offset,
                p_sort_by: sortBy
            });

        if (error) {
            logger.error({ err: error, blogId }, 'Service: Error calling get_threaded_comments RPC');
            throw error;
        }

        // Get total count of ROOT comments for pagination
        const { count, error: countError } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('blog_id', blogId)
            .eq('status', 'active')
            .is('parent_id', null);

        if (countError) {
            logger.error({ err: countError, blogId }, 'Service: Error fetching root comments count');
            throw countError;
        }

        // Build nested tree structure
        const commentMap = {};
        const rootComments = [];

        // First pass: Create objects and map them
        flatComments.forEach(c => {
            // Map DB columns to frontend expected structure
            const comment = {
                ...c,
                profiles: {
                    id: c.user_id,
                    first_name: c.user_name, // RPC returns name as user_name
                    avatar_url: c.user_avatar_url,
                    role: c.user_role
                },
                replies: []
            };

            // Remove flattened user columns to keep it clean
            delete comment.user_name;
            delete comment.user_avatar_url;
            delete comment.user_role;

            commentMap[c.id] = comment;
        });

        // Second pass: Link parents and children
        flatComments.forEach(c => {
            const comment = commentMap[c.id];
            if (c.parent_id && commentMap[c.parent_id]) {
                commentMap[c.parent_id].replies.push(comment);
            } else if (!c.parent_id) {
                rootComments.push(comment);
            }
        });

        logger.info({
            blogId,
            rootCount: rootComments.length,
            totalRootCount: count
        }, 'Service: Threaded comments built successfully');

        return {
            comments: rootComments,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        };
    }

    /**
     * Create a new comment
     */
    async createComment(userId, blogId, content, parentId = null) {
        logger.info({ userId, blogId, parentId }, 'Service: Creating comment');

        const { data, error } = await supabase
            .from('comments')
            .insert({
                user_id: userId,
                blog_id: blogId,
                content,
                parent_id: parentId,
                status: 'active'
            })
            .select(`
                *,
                profiles: user_id(id, first_name, last_name, avatar_url, roles(name))
            `)
            .single();

        if (error) {
            logger.error({ err: error, userId, blogId }, 'Service: Error inserting comment');
            throw error;
        }

        // Flatten the role structure to match frontend expectation
        if (data.profiles) {
            data.profiles.role = data.profiles.roles?.name || 'customer';
            delete data.profiles.roles;
        }

        return data;
    }

    /**
     * Update a comment (owner only)
     */
    async updateComment(commentId, userId, content) {
        logger.info({ commentId, userId }, 'Service: Updating comment');

        // First check ownership and time limit (15 mins)
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id, created_at')
            .eq('id', commentId)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError, commentId }, 'Service: Error fetching comment for update');
            throw fetchError;
        }
        if (!comment) throw new Error('Comment not found');

        if (comment.user_id !== userId) {
            logger.warn({ commentId, userId, ownerId: comment.user_id }, 'Service: Unauthorized update attempt');
            throw new Error('Unauthorized: You can only edit your own comments');
        }

        const minutesSincePost = (new Date() - new Date(comment.created_at)) / 60000;
        if (minutesSincePost > 15) {
            logger.warn({ commentId, minutesSincePost }, 'Service: Update time limit exceeded');
            throw new Error('Edit time limit exceeded (15 minutes)');
        }

        const { data, error } = await supabase
            .from('comments')
            .update({
                content,
                updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) {
            logger.error({ err: error, commentId }, 'Service: Error updating comment content');
            throw error;
        }
        return data;
    }

    /**
     * Soft delete a comment
     */
    async deleteComment(commentId, userId, userRole) {
        logger.info({ commentId, userId, userRole }, 'Service: Deleting comment');

        // Check permissions
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id')
            .eq('id', commentId)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError, commentId }, 'Service: Error fetching comment for deletion');
            throw fetchError;
        }
        if (!comment) throw new Error('Comment not found');

        const isOwner = comment.user_id === userId;
        const isAdmin = ['admin', 'manager'].includes(userRole);

        if (!isOwner && !isAdmin) {
            logger.warn({ commentId, userId, userRole }, 'Service: Unauthorized deletion attempt');
            throw new Error('Unauthorized');
        }

        const { data, error } = await supabase
            .from('comments')
            .update({
                status: 'deleted',
                deleted_at: new Date().toISOString(),
                deleted_by: userId
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) {
            logger.error({ err: error, commentId }, 'Service: Error soft-deleting comment');
            throw error;
        }
        return data;
    }

    /**
     * Flag a comment
     */
    async flagComment(commentId, userId, reason, details) {
        logger.info({ commentId, userId, reason }, 'Service: Flagging comment');

        const { data, error } = await supabase
            .from('comment_flags')
            .insert({
                comment_id: commentId,
                flagged_by: userId,
                reason,
                details
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                logger.warn({ commentId, userId }, 'Service: User already flagged this comment');
                throw new Error('You have already flagged this comment');
            }
            logger.error({ err: error, commentId, userId }, 'Service: Error flagging comment');
            throw error;
        }
        return data;
    }
}

module.exports = new CommentService();
