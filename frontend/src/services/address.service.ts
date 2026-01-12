import { apiClient } from "@/lib/api-client";
import type { CheckoutAddress, CreateAddressDto } from "@/types";



// Helper to transform backend Address (camelCase) to CheckoutAddress (snake_case)
interface BackendAddress {
    id: string;
    userId: string;
    type?: 'home' | 'work' | 'other';
    isPrimary: boolean;
    label?: string;
    phone?: string;
    streetAddress: string;
    apartment?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    createdAt: string;
    updatedAt: string;
}

const transformToCheckoutAddress = (data: BackendAddress): CheckoutAddress => ({
    id: data.id,
    user_id: data.userId,
    // Preserve the actual backend type (home/work/other)
    type: data.type || 'other',
    is_primary: data.isPrimary,
    full_name: data.label || 'User', // Use label as full_name, fallback to 'User'
    phone: data.phone || '', // Phone now stored via phone_numbers table
    address_line1: data.streetAddress,
    address_line2: data.apartment,
    city: data.city,
    state: data.state,
    postal_code: data.postalCode,
    country: data.country,
    created_at: data.createdAt,
    updated_at: data.updatedAt
});

// Helper to transform CreateAddressDto to backend payload
const transformToBackendPayload = (data: CreateAddressDto) => {
    // For profile types (home/work/other), pass them through to backend as-is
    // For checkout types (shipping/billing/both), map to 'other' to avoid unique constraint issues
    let backendType: 'home' | 'work' | 'other' = 'other';
    if (data.type === 'home' || data.type === 'work' || data.type === 'other') {
        backendType = data.type;
    } // else shipping/billing/both → defaults to 'other'

    return {
        type: backendType,
        streetAddress: data.address_line1,
        apartment: data.address_line2,
        city: data.city,
        state: data.state,
        postalCode: data.postal_code,
        country: data.country,
        isPrimary: data.is_primary,
        label: data.full_name, // Store full_name in label
        phone: data.phone // Include phone number
    };
};

export const addressService = {
    /**
     * Get all addresses for current user
     */
    getAddresses: async (): Promise<CheckoutAddress[]> => {
        const response = await apiClient.get('/addresses');
        return (response.data || []).map(transformToCheckoutAddress);
    },

    /**
     * Create a new address
     */
    createAddress: async (data: CreateAddressDto): Promise<CheckoutAddress> => {
        const payload = transformToBackendPayload(data);
        const response = await apiClient.post('/addresses', payload);
        return transformToCheckoutAddress(response.data.address);
    },

    /**
     * Update an address
     */
    updateAddress: async (id: string, data: CreateAddressDto): Promise<CheckoutAddress> => {
        const payload = transformToBackendPayload(data);
        const response = await apiClient.put(`/addresses/${id}`, payload);
        return transformToCheckoutAddress(response.data.address);
    },

    /**
     * Delete an address
     */
    deleteAddress: async (id: string): Promise<void> => {
        await apiClient.delete(`/addresses/${id}`);
    },

    /**
     * Set an address as primary
     */
    setPrimary: async (id: string): Promise<CheckoutAddress> => {
        const response = await apiClient.post(`/addresses/${id}/set-primary`);
        return transformToCheckoutAddress(response.data.address);
    },
};
