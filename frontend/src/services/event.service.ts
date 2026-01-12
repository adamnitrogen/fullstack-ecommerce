import { apiClient } from '@/lib/api-client';
import type { Event } from '@/types';

/**
 * Computes the event status based on startDate and endDate compared to current date.
 * - upcoming: startDate is in the future
 * - ongoing: current date is between startDate and endDate (or on startDate if no endDate)
 * - completed: endDate (or startDate if no endDate) is in the past
 */
function computeEventStatus(startDate: string, endDate?: string): 'upcoming' | 'ongoing' | 'completed' {
    const now = new Date();
    const start = new Date(startDate);

    // Normalize dates to start of day for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    // If no endDate, treat startDate as both start and end
    const end = endDate ? new Date(endDate) : start;
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (today < startDay) {
        return 'upcoming';
    } else if (today > endDay) {
        return 'completed';
    } else {
        return 'ongoing';
    }
}

/**
 * Applies computed status to an event based on its dates.
 */
function enrichEventWithStatus(event: Event): Event {
    return {
        ...event,
        status: computeEventStatus(event.startDate, event.endDate)
    };
}

export const eventService = {
    getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<{ events: Event[]; total: number }> => {
        const response = await apiClient.get('/events', { params });
        // Handle both old array response (fallback) and new paginated response
        const data = response.data;
        const events = Array.isArray(data) ? data : (data.events || []);
        const total = Array.isArray(data) ? data.length : (data.total || 0);

        return {
            events: events.map(enrichEventWithStatus),
            total
        };
    },

    getById: async (id: string): Promise<Event> => {
        const response = await apiClient.get(`/events/${id}`);
        // Apply dynamic status computation
        return enrichEventWithStatus(response.data);
    },

    create: async (event: Omit<Event, 'id'>): Promise<Event> => {
        const response = await apiClient.post('/events', event);
        return enrichEventWithStatus(response.data);
    },

    update: async (id: string, event: Partial<Event>): Promise<Event> => {
        const response = await apiClient.put(`/events/${id}`, event);
        return enrichEventWithStatus(response.data);
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/events/${id}`);
    },
};
