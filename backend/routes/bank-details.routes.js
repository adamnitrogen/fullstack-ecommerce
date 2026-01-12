const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase');
const { generateUPIQR, generateBankAccountQR } = require('../utils/qr-generator');
const { uploadBase64Image, uploadFileToSupabase, deleteFileFromSupabase } = require('../utils/upload-helper');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// GET all bank details
router.get('/', async (req, res) => {
    try {
        const { isAdmin } = req.query;

        let query = supabase
            .from('bank_details')
            .select('*')
            .eq('is_active', true);

        // No type restriction for public users - they can access both general and donation accounts
        // General accounts are shown in footer, donation accounts on donate page

        query = query.order('display_order');

        const { data, error } = await query;

        if (error) {
            logger.error({ err: error }, '[BankDetails] Error fetching bank details:');
            throw error;
        }

        // logger.info(`[BankDetails] Retrieved ${data.length} bank detail(s)`);
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

// POST create new bank account with auto QR generation
router.post('/', async (req, res) => {
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

        // Generate QR code automatically
        let qrDataURL;
        if (upi_id) {
            logger.info('[BankDetails] Generating UPI QR code');
            qrDataURL = await generateUPIQR(upi_id, account_name);
        } else {
            logger.info('[BankDetails] Generating bank account QR code');
            qrDataURL = await generateBankAccountQR({
                accountNumber: account_number,
                ifscCode: ifsc_code,
                bankName: bank_name,
                accountName: account_name,
                branchName: branch_name
            });
        }

        // Upload QR to Supabase Storage
        const qrFilename = `bank_qr_${Date.now()}.png`;
        const qrUrl = await uploadBase64Image(qrDataURL, 'qr-codes', qrFilename);
        logger.info({ data: qrUrl }, '[BankDetails] QR uploaded to:');

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
                qr_code_auto_url: qrUrl,
                use_manual_qr: false
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

// PUT update bank account (regenerate auto QR if details changed)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        logger.info({ data: id }, '[BankDetails] Updating bank detail:');

        // Fetch existing data
        const { data: existing, error: fetchError } = await supabase
            .from('bank_details')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // Check if QR-relevant fields have actually changed
        const qrFieldsChanged =
            (updates.upi_id !== undefined && updates.upi_id !== existing.upi_id) ||
            (updates.account_number !== undefined && updates.account_number !== existing.account_number) ||
            (updates.ifsc_code !== undefined && updates.ifsc_code !== existing.ifsc_code) ||
            (updates.account_name !== undefined && updates.account_name !== existing.account_name) ||
            (updates.bank_name !== undefined && updates.bank_name !== existing.bank_name) ||
            (updates.branch_name !== undefined && updates.branch_name !== existing.branch_name);

        if (qrFieldsChanged) {
            logger.info('[BankDetails] QR-relevant fields changed, regenerating QR code');

            // Merge with updates
            const merged = { ...existing, ...updates };

            // Delete old auto QR if it exists
            if (existing.qr_code_auto_url) {
                logger.info('[BankDetails] Deleting old auto QR code');
                await deleteFileFromSupabase(existing.qr_code_auto_url, 'qr-codes');
            }

            // Regenerate QR
            let qrDataURL;
            if (merged.upi_id) {
                logger.info('[BankDetails] Regenerating UPI QR code');
                qrDataURL = await generateUPIQR(merged.upi_id, merged.account_name);
            } else {
                logger.info('[BankDetails] Regenerating bank account QR code');
                qrDataURL = await generateBankAccountQR({
                    accountNumber: merged.account_number,
                    ifscCode: merged.ifsc_code,
                    bankName: merged.bank_name,
                    accountName: merged.account_name,
                    branchName: merged.branch_name
                });
            }

            // Upload new QR
            const qrFilename = `bank_qr_${id}_${Date.now()}.png`;
            const qrUrl = await uploadBase64Image(qrDataURL, 'qr-codes', qrFilename);

            updates.qr_code_auto_url = qrUrl;
            logger.info({ data: qrUrl }, '[BankDetails] Updated QR URL:');
        } else {
            logger.info('[BankDetails] No QR-relevant fields changed, keeping existing QR');
        }

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

// POST upload manual QR code for a bank account
router.post('/:id/manual-qr', upload.single('qr_image'), async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        logger.info({ data: id }, '[BankDetails] Uploading manual QR for:');

        // Fetch existing data to get old manual QR URL
        const { data: existing, error: fetchError } = await supabase
            .from('bank_details')
            .select('qr_code_manual_url')
            .eq('id', id)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError }, '[BankDetails] Error fetching existing data:');
        }

        // Delete old manual QR if it exists
        if (existing?.qr_code_manual_url) {
            logger.info('[BankDetails] Deleting old manual QR code');
            await deleteFileFromSupabase(existing.qr_code_manual_url, 'qr-codes');
        }

        // Upload to Supabase Storage
        const qrFilename = `bank_qr_manual_${id}_${Date.now()}.png`;
        const qrUrl = await uploadFileToSupabase(req.file, 'qr-codes', qrFilename);

        // Update database
        const { data, error } = await supabase
            .from('bank_details')
            .update({
                qr_code_manual_url: qrUrl,
                use_manual_qr: true, // Automatically switch to manual QR
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ err: error }, '[BankDetails] Manual QR update error:');
            throw error;
        }

        logger.info('[BankDetails] Successfully uploaded manual QR');
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] Manual QR upload error:');
        res.status(500).json({ error: 'Failed to upload manual QR code' });
    }
});

// PUT toggle between auto/manual QR
router.put('/:id/toggle-qr', async (req, res) => {
    try {
        const { id } = req.params;
        const { use_manual_qr } = req.body;

        const { data, error } = await supabase
            .from('bank_details')
            .update({
                use_manual_qr: use_manual_qr,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        logger.info(`[BankDetails] Toggled QR mode to: ${use_manual_qr ? 'manual' : 'auto'}`);
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] Toggle QR error:');
        res.status(500).json({ error: 'Failed to toggle QR mode' });
    }
});

// DELETE bank details
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        logger.info({ data: id }, '[BankDetails] Deleting bank detail:');

        // Fetch existing data to get QR URLs
        const { data: existing, error: fetchError } = await supabase
            .from('bank_details')
            .select('qr_code_auto_url, qr_code_manual_url')
            .eq('id', id)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError }, '[BankDetails] Error fetching bank details for deletion:');
            throw fetchError;
        }

        // Delete auto-generated QR if it exists
        if (existing?.qr_code_auto_url) {
            logger.info('[BankDetails] Deleting auto QR code from storage');
            await deleteFileFromSupabase(existing.qr_code_auto_url, 'qr-codes');
        }

        // Delete manual QR if it exists
        if (existing?.qr_code_manual_url) {
            logger.info('[BankDetails] Deleting manual QR code from storage');
            await deleteFileFromSupabase(existing.qr_code_manual_url, 'qr-codes');
        }

        // Soft delete by setting is_active to false
        const { error } = await supabase
            .from('bank_details')
            .update({ is_active: false, updated_at: new Date() })
            .eq('id', id);

        // Or hard delete (uncomment to use):
        // const { error } = await supabase
        //     .from('bank_details')
        //     .delete()
        //     .eq('id', id);

        if (error) {
            logger.error({ err: error }, '[BankDetails] Delete error:');
            throw error;
        }

        logger.info('[BankDetails] Successfully deleted bank detail and associated QR codes');
        res.json({ message: 'Bank detail and QR codes deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, '[BankDetails] DELETE error:');
        res.status(500).json({ error: 'Failed to delete bank detail' });
    }
});

module.exports = router;
