import { apiClient } from '@/lib/api-client';
import type { CheckoutSummary, RazorpayOrderResponse, Order } from '@/types';

export const checkoutService = {
    // Get checkout summary (cart + addresses + totals)
    getSummary: async (): Promise<CheckoutSummary> => {
        const response = await apiClient.get('/checkout/summary');
        return response.data;
    },

    // Create Razorpay payment order
    createPaymentOrder: async (amount: number): Promise<RazorpayOrderResponse> => {
        const response = await apiClient.post('/checkout/create-payment-order', { amount });
        return response.data;
    },

    // Verify payment and complete order
    verifyPayment: async (data: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        payment_id: string;
        shipping_address_id: string;
        billing_address_id: string;
        notes?: string;
    }): Promise<{ success: boolean; order: Order }> => {
        const response = await apiClient.post('/checkout/verify-payment', data);
        return response.data;
    },
};
