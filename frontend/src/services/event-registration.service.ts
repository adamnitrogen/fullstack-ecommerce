import { apiClient } from '@/lib/api-client';

export interface EventRegistration {
    id: string;
    registration_number: string;
    event_id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    amount: number;
    payment_status: 'pending' | 'paid' | 'failed' | 'free';
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    created_at: string;
    events?: {
        id: string;
        title: string;
        start_date: string;
        end_date?: string;
        location?: string;
        image?: string;
    };
}

export const eventRegistrationService = {
    getMyRegistrations: async (): Promise<EventRegistration[]> => {
        const response = await apiClient.get('/event-registrations/my');
        return response.data;
    },

    cancelRegistration: async (registrationId: string) => {
        const response = await apiClient.post('/event-registrations/cancel', { registrationId });
        return response.data;
    }
};
