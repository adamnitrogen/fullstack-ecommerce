const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Admin Alert Service
 * Handles persistent dashboard alerts for admin users
 */
const AdminAlertService = {
    /**
     * Create a new admin alert
     */
    async createAlert({ type, reference_id, title, content, priority = 'medium', metadata = {} }) {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .insert([{
                    type,
                    reference_id,
                    title,
                    content,
                    priority,
                    metadata
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error, type, title }, 'Failed to create admin alert:');
            throw error;
        }
    },

    /**
     * Get unread alerts
     */
    async getUnreadAlerts() {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .select('*')
                .eq('status', 'unread')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch unread admin alerts:');
            throw error;
        }
    },

    /**
     * Mark alert as read (dismiss)
     */
    async markAsRead(id) {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .update({
                    status: 'read',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error, id }, 'Failed to mark admin alert as read:');
            throw error;
        }
    },

    /**
     * Mark all as read
     */
    async markAllAsRead() {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .update({
                    status: 'read',
                    updated_at: new Date().toISOString()
                })
                .eq('status', 'unread')
                .select();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error }, 'Failed to mark all admin alerts as read:');
            throw error;
        }
    },

    /**
     * Mark alert as read by reference ID
     */
    async markAsReadByReference(type, reference_id) {
        try {
            const { data, error } = await supabase
                .from('admin_alerts')
                .update({
                    status: 'read',
                    updated_at: new Date().toISOString()
                })
                .eq('type', type)
                .eq('reference_id', reference_id)
                .eq('status', 'unread')
                .select();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error({ err: error, type, reference_id }, 'Failed to mark admin alert as read by reference:');
            throw error;
        }
    }
};

module.exports = AdminAlertService;
