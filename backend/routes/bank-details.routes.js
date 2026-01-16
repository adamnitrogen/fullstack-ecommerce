const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

// GET all bank details
router.get('/', async (req, res) => {
    try {
        let query = supabase
            .from('bank_details')
            .select('*')
            .eq('is_active', true);

        query = query.order('display_order');

        const { data, error } = await query;

        if (error) {
            logger.error({ err: error }, '[BankDetails] Error fetching bank details:');
            throw error;
        }

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] GET error:');
        res.status(500).json({ error: 'Failed to fetch bank details' });
    }
});

// GET single bank detail
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('bank_details')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] GET single error:');
        res.status(500).json({ error: 'Failed to fetch bank detail' });
    }
});

// POST create new bank account - Admin only
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const {
            account_name,
            account_number,
            ifsc_code,
            bank_name,
            branch_name,
            upi_id,
            type,
            display_order
        } = req.body;

        logger.info({ data: { account_name, type } }, '[BankDetails] Creating new bank detail:');

        // Validate required fields
        if (!account_name || !account_number || !ifsc_code || !bank_name || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Insert into database
        const { data, error } = await supabase
            .from('bank_details')
            .insert({
                account_name,
                account_number,
                ifsc_code,
                bank_name,
                branch_name: branch_name || null,
                upi_id: upi_id || null,
                type,
                display_order: display_order || 0,
            })
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, '[BankDetails] Insert error:');
            throw error;
        }

        logger.info({ data: data.id }, '[BankDetails] Successfully created bank detail with ID:');
        res.status(201).json(data);
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] POST error:');
        res.status(500).json({ error: 'Failed to create bank detail' });
    }
});

// PUT update bank account - Admin only
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        logger.info({ data: id }, '[BankDetails] Updating bank detail:');

        updates.updated_at = new Date();

        const { data, error } = await supabase
            .from('bank_details')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, '[BankDetails] Update error:');
            throw error;
        }

        logger.info('[BankDetails] Successfully updated bank detail');
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] PUT error:');
        res.status(500).json({ error: 'Failed to update bank detail' });
    }
});

// DELETE bank details - Admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        logger.info({ data: id }, '[BankDetails] Deleting bank detail:');

        // Soft delete by setting is_active to false
        const { error } = await supabase
            .from('bank_details')
            .update({ is_active: false, updated_at: new Date() })
            .eq('id', id);

        if (error) {
            logger.error({ err: error }, '[BankDetails] Delete error:');
            throw error;
        }

        logger.info('[BankDetails] Successfully deleted bank detail');
        res.json({ message: 'Bank detail deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] DELETE error:');
        res.status(500).json({ error: 'Failed to delete bank detail' });
    }
});

module.exports = router;
