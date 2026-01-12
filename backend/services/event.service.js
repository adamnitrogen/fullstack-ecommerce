const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { deletePhotoByUrl } = require('./photo.service');

// Helper to map snake_case DB object to camelCase frontend object
const mapToFrontend = (event) => {
    if (!event) return null;
    return {
        id: event.id,
        title: event.title,
        description: event.description,
        startDate: event.start_date,
        endDate: event.end_date,
        location: event.location,
        image: event.image,
        capacity: event.capacity,
        registrations: event.registrations,
        registrationAmount: event.registration_amount,
        category: event.category,
        status: event.status,
        kathaVachak: event.katha_vachak,
        contactAddress: event.contact_address,
        isRegistrationEnabled: event.is_registration_enabled,
        keyHighlights: event.key_highlights,
        specialPrivileges: event.special_privileges,
        createdAt: event.created_at,
        updatedAt: event.updated_at
    };
};

// Helper to map camelCase frontend object to snake_case DB object
const mapToDb = (event) => {
    const dbEvent = {
        title: event.title,
        description: event.description,
        start_date: event.startDate,
        end_date: event.endDate,
        location: event.location,
        image: event.image,
        capacity: event.capacity,
        registration_amount: event.registrationAmount,
        category: event.category,
        status: event.status,
        katha_vachak: event.kathaVachak,
        contact_address: event.contactAddress,
        is_registration_enabled: event.isRegistrationEnabled,
        key_highlights: event.keyHighlights,
        special_privileges: event.specialPrivileges,
        updated_at: new Date().toISOString()
    };

    // Remove undefined fields
    Object.keys(dbEvent).forEach(key => dbEvent[key] === undefined && delete dbEvent[key]);

    return dbEvent;
};

class EventService {
    /**
     * Get all events with pagination and search
     */
    static async getAllEvents({ page = 1, limit = 15, search = '', status = 'all' } = {}) {
        const offset = (page - 1) * limit;

        let query = supabase
            .from('events')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.ilike('title', `%${search}%`);
        }

        // Status filtering using SQL Date logic
        if (status && status !== 'all') {
            const now = new Date().toISOString();

            switch (status) {
                case 'upcoming':
                    // Start date is in the future
                    query = query.gt('start_date', now);
                    break;
                case 'completed':
                    // End date is in the past (or start date if no end date)
                    query = query.or(`end_date.lt.${now},and(end_date.is.null,start_date.lt.${now})`);
                    break;
                case 'ongoing':
                    // Started but not ended
                    // start_date <= NOW AND (end_date >= NOW OR end_date IS NULL)
                    query = query.lte('start_date', now).or(`end_date.gte.${now},end_date.is.null`);
                    break;
            }
        }

        query = query
            .order('start_date', { ascending: true })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
            events: data.map(mapToFrontend),
            total: count
        };
    }

    /**
     * Get single event by ID
     */
    static async getEventById(id) {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return mapToFrontend(data);
    }

    /**
     * Create event
     */
    static async createEvent(eventData) {
        const dbEvent = mapToDb(eventData);
        // Add created_at for new records
        dbEvent.created_at = new Date().toISOString();
        // Default registrations to 0 if not provided
        if (dbEvent.registrations === undefined) dbEvent.registrations = 0;

        const { data, error } = await supabase
            .from('events')
            .insert([dbEvent])
            .select()
            .single();

        if (error) throw error;

        return mapToFrontend(data);
    }

    /**
     * Update event
     */
    static async updateEvent(id, eventData) {
        const dbEvent = mapToDb(eventData);

        const { data, error } = await supabase
            .from('events')
            .update(dbEvent)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return mapToFrontend(data);
    }

    /**
     * Delete event
     */
    static async deleteEvent(id) {
        // 1. Get event to find image URL
        const { data: event, error: fetchError } = await supabase
            .from('events')
            .select('image')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Delete event from database first
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // 3. Clean up event image from storage and photos table
        if (event && event.image) {
            // Don't await - let cleanup happen asynchronously
            deletePhotoByUrl(event.image).catch(err =>
                logger.error('Error cleaning up event image:', err)
            );
        }

        return true;
    }
}

module.exports = EventService;
