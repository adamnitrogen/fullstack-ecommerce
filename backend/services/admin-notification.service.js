const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Admin Notification Service
 * Handles order notifications for admin users
 */

// Get admin notifications with order details
const getAdminNotifications = async (adminId, filters = {}) => {
    let query = supabase
        .from('order_notifications')
        .select(`
            *,
            orders (
                id,
                orderNumber,
                customerName,
                totalAmount,
                status,
                createdAt
            )
        `)
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false });

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

// Get unread notification count
const getUnreadCount = async (adminId) => {
    const { count, error } = await supabase
        .from('order_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('admin_id', adminId)
        .eq('status', 'unread');

    if (error) throw error;
    return count || 0;
};

// Mark notification as read
const markAsRead = async (notificationId, adminId) => {
    const { data, error } = await supabase
        .from('order_notifications')
        .update({
            status: 'read',
            read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('admin_id', adminId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Mark all as read
const markAllAsRead = async (adminId) => {
    const { data, error } = await supabase
        .from('order_notifications')
        .update({
            status: 'read',
            read_at: new Date().toISOString()
        })
        .eq('admin_id', adminId)
        .eq('status', 'unread')
        .select();

    if (error) throw error;
    return data;
};

// Archive notification
const archiveNotification = async (notificationId, adminId) => {
    const { data, error } = await supabase
        .from('order_notifications')
        .update({ status: 'archived' })
        .eq('id', notificationId)
        .eq('admin_id', adminId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

module.exports = {
    getAdminNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    archiveNotification
};
