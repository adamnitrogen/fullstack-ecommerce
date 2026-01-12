import { apiClient } from "@/lib/api-client";
import { Comment, FlaggedComment } from "@/types";

export const blogCommentService = {
    // Get comments for a blog
    getBlogComments: async (blogId: string): Promise<Comment[]> => {
        const response = await apiClient.get(`/blog-comments/blog/${blogId}`);
        return response.data;
    },

    // Create a new comment or reply
    createComment: async (data: {
        blogId: string;
        userId: string;
        content: string;
        parentId?: string;
    }): Promise<Comment> => {
        const response = await apiClient.post("/blog-comments", data);
        return response.data;
    },

    // Update a comment
    updateComment: async (id: string, content: string): Promise<Comment> => {
        const response = await apiClient.put(`/blog-comments/${id}`, { content });
        return response.data;
    },

    // Delete a comment
    deleteComment: async (id: string): Promise<void> => {
        await apiClient.delete(`/blog-comments/${id}`);
    },

    // Flag a comment
    flagComment: async (id: string, reason: string, flaggedBy: string): Promise<Comment> => {
        const response = await apiClient.post(`/blog-comments/${id}/flag`, {
            reason,
            flaggedBy,
        });
        return response.data;
    },

    // Get all flagged comments (Admin/Manager)
    getFlaggedComments: async (): Promise<FlaggedComment[]> => {
        const response = await apiClient.get("/blog-comments/flagged/all");
        return response.data;
    },

    // Resolve flagged comment (Admin/Manager)
    resolveFlaggedComment: async (id: string, action: "dismiss" | "delete", userId?: string): Promise<void> => {
        await apiClient.post(`/blog-comments/${id}/resolve`, { action, userId });
    },
};
