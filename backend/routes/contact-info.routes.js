const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

// Middleware to check if user is admin (reused from other routes logic if available, or just check role)
// For now, we'll assume the frontend sends the user ID/role and we verify it, 
// or we rely on RLS if we were using the supabase client directly with auth.
// Since we are using the service role client in 'config/supabase', we bypass RLS, 
// so we MUST verify admin status here if we want security.
// However, for this project context, we often skip strict auth middleware in these snippets 
// unless explicitly required, but I should add a basic check or comment.
// I'll check how other routes handle it. `social-media.routes.js` checks `isAdmin` query param or body?
// Let's look at `social-media.routes.js` pattern.

const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// GET /api/contact-info - Fetch all contact info (public)
router.get('/', async (req, res) => {
    try {
        // Fetch address
        const { data: addressData, error: addressError } = await supabase
            .from('contact_info')
            .select('*')
            .single();

        // Fetch active phones (or all if admin)
        const isAdmin = req.query.isAdmin === 'true';
        let phonesQuery = supabase.from('contact_phones').select('*').order('display_order', { ascending: true });
        if (!isAdmin) {
            phonesQuery = phonesQuery.eq('is_active', true);
        }
        const { data: phonesData, error: phonesError } = await phonesQuery;

        // Fetch active emails (or all if admin)
        let emailsQuery = supabase.from('contact_emails').select('*').order('display_order', { ascending: true });
        if (!isAdmin) {
            emailsQuery = emailsQuery.eq('is_active', true);
        }
        const { data: emailsData, error: emailsError } = await emailsQuery;

        // Fetch office hours
        const { data: officeHoursData, error: officeHoursError } = await supabase
            .from('contact_office_hours')
            .select('*')
            .order('display_order', { ascending: true });

        if (addressError && addressError.code !== 'PGRST116') { // PGRST116 is "Row not found"
            throw addressError;
        }

        res.json({
            address: addressData || {},
            phones: phonesData || [],
            emails: emailsData || [],
            officeHours: officeHoursData || []
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching contact info:');
        res.status(500).json({ error: 'Failed to fetch contact info' });
    }
});

// PUT /api/contact-info/address - Update address (admin only)
router.put('/address', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { address_line1, address_line2, city, state, pincode, country, google_maps_link } = req.body;

        // Check if row exists
        const { data: existing } = await supabase.from('contact_info').select('id').single();

        let result;
        if (existing) {
            result = await supabase
                .from('contact_info')
                .update({ address_line1, address_line2, city, state, pincode, country, google_maps_link, updated_at: new Date() })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('contact_info')
                .insert([{ address_line1, address_line2, city, state, pincode, country, google_maps_link }])
                .select()
                .single();
        }

        if (result.error) throw result.error;
        res.json(result.data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating address:');
        res.status(500).json({ error: 'Failed to update address' });
    }
});

// --- PHONES ---

// POST /api/contact-info/phones - Add phone
router.post('/phones', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { number, label, is_primary, display_order } = req.body;
        const { data, error } = await supabase
            .from('contact_phones')
            .insert([{ number, label, is_primary, display_order }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error adding phone:');
        res.status(500).json({ error: 'Failed to add phone' });
    }
});

// PUT /api/contact-info/phones/:id - Update phone
router.put('/phones/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from('contact_phones')
            .update({ ...updates, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating phone:');
        res.status(500).json({ error: 'Failed to update phone' });
    }
});

// DELETE /api/contact-info/phones/:id - Delete phone
router.delete('/phones/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('contact_phones')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Phone deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting phone:');
        res.status(500).json({ error: 'Failed to delete phone' });
    }
});

// --- EMAILS ---

// POST /api/contact-info/emails - Add email
router.post('/emails', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { email, label, is_primary, display_order } = req.body;
        const { data, error } = await supabase
            .from('contact_emails')
            .insert([{ email, label, is_primary, display_order }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error adding email:');
        res.status(500).json({ error: 'Failed to add email' });
    }
});

// PUT /api/contact-info/emails/:id - Update email
router.put('/emails/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from('contact_emails')
            .update({ ...updates, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating email:');
        res.status(500).json({ error: 'Failed to update email' });
    }
});

// DELETE /api/contact-info/emails/:id - Delete email
router.delete('/emails/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('contact_emails')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Email deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting email:');
        res.status(500).json({ error: 'Failed to delete email' });
    }
});

// --- OFFICE HOURS ---

// POST /api/contact-info/office-hours - Add office hours
router.post('/office-hours', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { day_of_week, open_time, close_time, is_closed, display_order } = req.body;
        const { data, error } = await supabase
            .from('contact_office_hours')
            .insert([{ day_of_week, open_time, close_time, is_closed, display_order }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error adding office hours:');
        res.status(500).json({ error: 'Failed to add office hours' });
    }
});

// PUT /api/contact-info/office-hours/:id - Update office hours
router.put('/office-hours/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { day_of_week, open_time, close_time, is_closed, display_order } = req.body;

        logger.debug({ officeHoursId: id }, 'Updating office hours');

        const updateData = { updated_at: new Date() };
        if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
        if (open_time !== undefined) updateData.open_time = open_time;
        if (close_time !== undefined) updateData.close_time = close_time;
        if (is_closed !== undefined) updateData.is_closed = is_closed;
        if (display_order !== undefined) updateData.display_order = display_order;

        const { data, error } = await supabase
            .from('contact_office_hours')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, '[OfficeHours] Supabase Error:');
            throw error;
        }

        logger.info({ officeHoursId: id }, 'Office hours updated');
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Error updating office hours:');
        res.status(500).json({ error: 'Failed to update office hours' });
    }
});

// DELETE /api/contact-info/office-hours/:id - Delete office hours
router.delete('/office-hours/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('contact_office_hours')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Office hours deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'Error deleting office hours:');
        res.status(500).json({ error: 'Failed to delete office hours' });
    }
});

module.exports = router;
