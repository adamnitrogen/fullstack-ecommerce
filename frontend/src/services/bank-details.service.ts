import { apiClient } from '@/lib/api-client';

export interface BankDetails {
    id: string;
    account_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    branch_name?: string;
    upi_id?: string;
    type: 'general' | 'donation';
    qr_code_auto_url?: string;
    qr_code_manual_url?: string;
    use_manual_qr: boolean;
    is_active: boolean;
    display_order: number;
    created_at?: string;
    updated_at?: string;
}

export const bankDetailsService = {
    /**
     * Get all bank details
     * @param isAdmin - If true, returns all details including donation accounts
     */
    getAll: async (isAdmin = false): Promise<BankDetails[]> => {
        const response = await apiClient.get(`/bank-details?isAdmin=${isAdmin}`);
        return response.data;
    },

    /**
     * Get single bank detail by ID
     */
    getById: async (id: string): Promise<BankDetails> => {
        const response = await apiClient.get(`/bank-details/${id}`);
        return response.data;
    },

    /**
     * Create new bank account (auto-generates QR code)
     */
    create: async (data: Partial<BankDetails>): Promise<BankDetails> => {
        const response = await apiClient.post('/bank-details', data);
        return response.data;
    },

    /**
     * Update bank account (regenerates QR if details changed)
     */
    update: async (id: string, data: Partial<BankDetails>): Promise<BankDetails> => {
        const response = await apiClient.put(`/bank-details/${id}`, data);
        return response.data;
    },

    /**
     * Delete bank account (soft delete)
     */
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/bank-details/${id}`);
    },

    /**
     * Upload manual QR code image
     */
    uploadManualQR: async (id: string, file: File): Promise<BankDetails> => {
        const formData = new FormData();
        formData.append('qr_image', file);

        const response = await apiClient.post(`/bank-details/${id}/manual-qr`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Toggle between auto-generated and manual QR code
     */
    toggleQRMode: async (id: string, useManualQR: boolean): Promise<BankDetails> => {
        const response = await apiClient.put(`/bank-details/${id}/toggle-qr`, {
            use_manual_qr: useManualQR,
        });
        return response.data;
    },

    /**
     * Get the active QR code URL for a bank detail
     */
    getActiveQRUrl: (bankDetail: BankDetails): string | undefined => {
        if (bankDetail.use_manual_qr && bankDetail.qr_code_manual_url) {
            return bankDetail.qr_code_manual_url;
        }
        return bankDetail.qr_code_auto_url;
    },
};
