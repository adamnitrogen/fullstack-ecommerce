import { apiClient } from '@/lib/api-client';
import type { Coupon, CreateCouponDto } from '@/types';

export const couponService = {
    // Get all coupons (admin only)
    getAll: async (filters?: { type?: string; is_active?: boolean; expired?: boolean }): Promise<Coupon[]> => {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
        if (filters?.expired !== undefined) params.append('expired', String(filters.expired));

        const response = await apiClient.get(`/coupons?${params.toString()}`);
        return response.data;
    },

    // Get active coupons for banners (public)
    getActive: async (): Promise<Coupon[]> => {
        const response = await apiClient.get('/coupons/active');
        return response.data;
    },

    // Get single coupon by ID (admin only)
    getById: async (id: string): Promise<Coupon> => {
        const response = await apiClient.get(`/coupons/${id}`);
        return response.data;
    },

    // Create new coupon (admin only)
    create: async (coupon: CreateCouponDto): Promise<Coupon> => {
        const response = await apiClient.post('/coupons', coupon);
        return response.data;
    },

    // Update coupon (admin only)
    update: async (id: string, coupon: Partial<CreateCouponDto>): Promise<Coupon> => {
        const response = await apiClient.put(`/coupons/${id}`, coupon);
        return response.data;
    },

    // Delete/deactivate coupon (admin only)
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/coupons/${id}`);
    },
};
