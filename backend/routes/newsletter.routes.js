const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');

// --- NEWSLETTER SUBSCRIBERS ---

// Get subscriber stats (MUST be before /subscribers/:id)
router.get('/subscribers/stats', async (req, res) => {
    try {
        const { count: totalCount, error: allError } = await supabase
            .from('newsletter_subscribers')
            .select('*', { count: 'exact', head: true });

        const { count: activeCount, error: activeError } = await supabase
            .from('newsletter_subscribers')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (allError) throw allError;
        if (activeError) throw activeError;

        res.json({
            total: totalCount || 0,
            active: activeCount || 0,
            inactive: (totalCount || 0) - (activeCount || 0)
        });
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Stats Error:');
        res.status(500).json({ error: error.message });
    }
});

// Get all subscribers (with optional filter)
router.get('/subscribers', async (req, res) => {
    try {
        const { active } = req.query;

        let query = supabase
            .from('newsletter_subscribers')
            .select('*')
            .order('subscribed_at', { ascending: false });

        // Filter by active status if provided
        if (active !== undefined) {
            query = query.eq('is_active', active === 'true');
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscribers Get Error:');
        res.status(500).json({ error: error.message });
    }
});

// Add a new subscriber
router.post('/subscribers', async (req, res) => {
    try {
        const { email, name } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const { data, error } = await supabase
            .from('newsletter_subscribers')
            .insert({
                email: email.toLowerCase().trim(),
                name: name?.trim() || null,
                is_active: true,
                subscribed_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            // Check for duplicate email
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Email already subscribed' });
            }
            throw error;
        }

        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscriber Create Error:');
        res.status(500).json({ error: error.message });
    }
});

// Update a subscriber
router.put('/subscribers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, is_active } = req.body;

        const updateData = {};
        if (email !== undefined) updateData.email = email.toLowerCase().trim();
        if (name !== undefined) updateData.name = name?.trim() || null;
        if (is_active !== undefined) {
            updateData.is_active = is_active;
            // Set unsubscribed_at if deactivating
            if (!is_active) {
                updateData.unsubscribed_at = new Date().toISOString();
            } else {
                updateData.unsubscribed_at = null;
            }
        }

        const { data, error } = await supabase
            .from('newsletter_subscribers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Email already exists' });
            }
            throw error;
        }

        if (!data) {
            return res.status(404).json({ error: 'Subscriber not found' });
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscriber Update Error:');
        res.status(500).json({ error: error.message });
    }
});

// Delete a subscriber
router.delete('/subscribers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('newsletter_subscribers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Subscriber Delete Error:');
        res.status(500).json({ error: error.message });
    }
});

// --- NEWSLETTER CONFIG ---

// Get newsletter configuration
router.get('/config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('newsletter_config')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        // Return default if no config exists
        const config = data || {
            sender_name: 'Gau Gyaan Newsletter',
            sender_email: 'newsletter@gaugyan.com',
            footer_text: 'Thank you for subscribing to our newsletter.'
        };

        res.json(config);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Config Get Error:');
        res.status(500).json({ error: error.message });
    }
});

// Update newsletter configuration
router.put('/config', async (req, res) => {
    try {
        const { sender_name, sender_email, footer_text } = req.body;

        // Check if config exists
        const { data: existing } = await supabase
            .from('newsletter_config')
            .select('id')
            .single();

        let result;
        if (existing) {
            // Update existing
            result = await supabase
                .from('newsletter_config')
                .update({
                    sender_name,
                    sender_email,
                    footer_text
                })
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            // Insert new
            result = await supabase
                .from('newsletter_config')
                .insert({
                    sender_name,
                    sender_email,
                    footer_text
                })
                .select()
                .single();
        }

        if (result.error) throw result.error;

        res.json(result.data);
    } catch (error) {
        logger.error({ err: error }, 'Newsletter Config Update Error:');
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
