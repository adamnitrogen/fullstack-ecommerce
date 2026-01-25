const EventPricingService = require('./event-pricing.service');

/**
 * Map snake_case DB object to camelCase frontend object
 */
const mapToFrontend = (event, lang = 'en') => {
    if (!event) return null;
    return {
        id: event.id,
        title: (event.title_i18n && event.title_i18n[lang]) || event.title,
        description: (event.description_i18n && event.description_i18n[lang]) || event.description,
        startDate: event.start_date,
        startTime: event.start_time,
        endDate: event.end_date,
        endTime: event.end_time,
        location: event.location,
        image: event.image,
        capacity: event.capacity,
        registrations: event.registrations,
        registrationAmount: event.registration_amount,
        gstRate: event.gst_rate,
        basePrice: event.base_price,
        gstAmount: event.gst_amount,
        registrationDeadline: event.registration_deadline,
        category: event.category,
        status: event.status,
        kathaVachak: event.katha_vachak,
        contactAddress: event.contact_address,
        isRegistrationEnabled: event.is_registration_enabled,
        keyHighlights: (event.key_highlights_i18n && event.key_highlights_i18n[lang]) || event.key_highlights,
        specialPrivileges: (event.special_privileges_i18n && event.special_privileges_i18n[lang]) || event.special_privileges,
        cancellationStatus: event.cancellation_status,
        cancelledAt: event.cancelled_at,
        cancellationReason: event.cancellation_reason,
        cancellationCorrelationId: event.cancellation_correlation_id,
        createdAt: event.created_at,
        updatedAt: event.updated_at
    };
};

/**
 * Map camelCase frontend object to snake_case DB object
 */
const mapToDb = (event) => {
    // Calculate tax breakdown if pricing info is provided
    let pricing = {
        basePrice: 0,
        gstAmount: 0,
        totalAmount: event.registrationAmount || 0,
        gstRate: event.gstRate || 0
    };

    if (event.registrationAmount > 0) {
        pricing = EventPricingService.calculateBreakdown(event.registrationAmount, event.gstRate);
    }

    const dbEvent = {
        title: event.title,
        description: event.description,
        start_date: event.startDate,
        start_time: event.startTime,
        end_date: event.endDate,
        end_time: event.endTime,
        location: event.location,
        image: event.image,
        capacity: event.capacity,
        registration_amount: pricing.totalAmount,
        gst_rate: pricing.gstRate,
        base_price: pricing.basePrice,
        gst_amount: pricing.gstAmount,
        registration_deadline: event.registrationDeadline,
        category: event.category,
        status: event.status,
        katha_vachak: event.kathaVachak,
        contact_address: event.contactAddress,
        is_registration_enabled: event.isRegistrationEnabled,
        key_highlights: event.keyHighlights,
        special_privileges: event.specialPrivileges,
        cancellation_status: event.cancellationStatus,
        cancelled_at: event.cancelledAt,
        cancellation_reason: event.cancellationReason,
        cancellation_correlation_id: event.cancellationCorrelationId,
        updated_at: new Date().toISOString()
    };

    // Remove undefined fields
    Object.keys(dbEvent).forEach(key => dbEvent[key] === undefined && delete dbEvent[key]);

    return dbEvent;
};

module.exports = {
    mapToFrontend,
    mapToDb
};
