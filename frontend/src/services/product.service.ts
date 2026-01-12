import { apiClient } from '@/lib/api-client';
import type { Product } from '@/types';

export const productService = {
    getAll: async (params?: { page?: number; limit?: number; search?: string; category?: string; sortBy?: string }): Promise<{ products: Product[]; total: number; stats: { outOfStockCount: number; criticalStockCount: number; lowStockCount: number } }> => {
        const response = await apiClient.get('/products', { params });
        return response.data;
    },

    getById: async (id: string): Promise<Product> => {
        const response = await apiClient.get(`/products/${id}`);
        return response.data;
    },

    create: async (product: Omit<Product, 'id'>): Promise<Product> => {
        const response = await apiClient.post('/products', product);
        return response.data;
    },

    update: async (id: string, product: Partial<Product>): Promise<Product> => {
        const response = await apiClient.put(`/products/${id}`, product);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/products/${id}`);
    },
};
