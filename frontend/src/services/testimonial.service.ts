import { apiClient as api } from "@/lib/api-client";
import type { Testimonial } from "@/types";

export const testimonialService = {
    // Get all testimonials
    getAll: async (): Promise<Testimonial[]> => {
        const response = await api.get("/testimonials");
        return response.data;
    },

    // Get testimonial by ID
    getById: async (id: string): Promise<Testimonial> => {
        const response = await api.get(`/testimonials/${id}`);
        return response.data;
    },

    // Create new testimonial
    create: async (data: Partial<Testimonial>): Promise<Testimonial> => {
        const response = await api.post("/testimonials", data);
        return response.data;
    },

    // Update testimonial
    update: async (id: string, data: Partial<Testimonial>): Promise<Testimonial> => {
        const response = await api.put(`/testimonials/${id}`, data);
        return response.data;
    },

    // Delete testimonial
    delete: async (id: string): Promise<void> => {
        await api.delete(`/testimonials/${id}`);
    },
};
