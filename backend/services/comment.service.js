const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class CommentService {
    /**
   * Get comments for a blog post with pagination (threaded)
   */
    async getComments(blogId, page = 1, limit = 20, sortBy = 'newest') {
        const offset = (page - 1) * limit;

        // Call the stored procedure to get flat list of threaded comments
        const { data: flatComments, error } = await supabase
            .rpc('get_threaded_comments', {
                p_blog_id: blogId,
                p_limit: limit,
                p_offset: offset,
                p_sort_by: sortBy
            });

        if (error) throw error;

        // Get total count of ROOT comments for pagination
        const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('blog_id', blogId)
            .eq('status', 'active')
            .is('parent_id', null);

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
                    name: c.user_name,
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
            // Note: If parent is not in the map (e.g. parent is on another page but we fetched child? 
            // The RPC ensures we fetch roots and their descendants, so this shouldn't happen 
            // unless we have orphans, which we treat as roots or ignore)
        });

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
                profiles: user_id(id, name, avatar_url, roles(name))
            `)
            .single();

        if (error) throw error;

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
        // First check ownership and time limit (15 mins)
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id, created_at')
            .eq('id', commentId)
            .single();

        if (fetchError) throw fetchError;
        if (!comment) throw new Error('Comment not found');

        if (comment.user_id !== userId) {
            throw new Error('Unauthorized: You can only edit your own comments');
        }

        const minutesSincePost = (new Date() - new Date(comment.created_at)) / 60000;
        if (minutesSincePost > 15) {
            throw new Error('Edit time limit exceeded (15 minutes)');
        }

        const { data, error } = await supabase
            .from('comments')
            .update({
                content,
                edit_count: supabase.rpc('increment_counter', { row_id: commentId }) // Simplified, actual logic in trigger
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Soft delete a comment
     */
    async deleteComment(commentId, userId, userRole) {
        // Check permissions
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id')
            .eq('id', commentId)
            .single();

        if (fetchError) throw fetchError;
        if (!comment) throw new Error('Comment not found');

        const isOwner = comment.user_id === userId;
        const isAdmin = ['admin', 'manager'].includes(userRole);

        if (!isOwner && !isAdmin) {
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

        if (error) throw error;
        return data;
    }

    /**
     * Flag a comment
     */
    async flagComment(commentId, userId, reason, details) {
        // Insert into comment_flags table
        // The trigger will automatically update the comments table
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
                throw new Error('You have already flagged this comment');
            }
            throw error;
        }
        return data;
    }
}

module.exports = new CommentService();
