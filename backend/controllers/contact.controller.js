const { z } = require('zod');
const logger = require('../utils/logger');
const contactService = require('../services/contact.service');
const emailService = require('../services/email.service');
const AdminAlertService = require('../services/admin-alert.service');

// Validation schema
const contactSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email address'),
    message: z.string().min(10, 'Message must be at least 10 characters').max(2000)
});

exports.submitContactForm = async (req, res, next) => {
    try {
        // 1. Validation
        const validatedData = contactSchema.parse(req.body);

        // 2. Extract client info
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        logger.info({ email: validatedData.email }, 'Processing contact form submission');

        // 3. Store in Database
        const message = await contactService.createMessage({
            ...validatedData,
            ipAddress,
            userAgent
        });

        // 3.5. Trigger Admin Alert (Persistent on Dashboard)
        AdminAlertService.createAlert({
            type: 'contact_message',
            reference_id: message.id,
            title: `New Message from ${validatedData.name}`,
            content: validatedData.message.substring(0, 100) + (validatedData.message.length > 100 ? '...' : ''),
            priority: 'medium',
            metadata: {
                email: validatedData.email,
                name: validatedData.name
            }
        }).catch(err => logger.error({ err }, 'Failed to create admin alert for contact message'));

        // 4. Send Internal Notification (Async - don't block response)
        // We catch errors here to ensure API still returns success to user if DB save worked
        emailService.sendContactNotification(message).catch(err => {
            logger.error({ err, messageId: message.id }, 'Failed to send internal contact notification');
        });

        // 5. Send Auto-Reply (Async)
        emailService.sendContactAutoReply(validatedData.email, validatedData.name).catch(err => {
            logger.error({ err, email: validatedData.email }, 'Failed to send contact auto-reply');
        });

        // 6. Return Success
        res.status(201).json({
            success: true,
            message: 'Message received successfully',
            data: {
                id: message.id
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors
            });
        }
        next(error);
    }
};
exports.getMessages = async (req, res) => {
    try {
        const messages = await contactService.getAll();
        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching contact messages:');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getMessageDetail = async (req, res) => {
    try {
        const messageId = req.params.id;
        logger.info({ messageId }, 'Fetching contact message detail');
        const message = await contactService.getById(messageId);
        if (message) logger.info({ messageId }, 'Fetched contact message successfully');
        else logger.info({ messageId }, 'No contact message found');

        // Auto-mark as READ if it's NEW
        if (message && message.status === 'NEW') {
            logger.info({ messageId }, 'Auto-marking message as READ');
            await contactService.updateStatus(message.id, 'READ');
            message.status = 'READ';
        }

        // Sync: Mark corresponding admin alert as READ
        logger.info({ messageId }, 'Syncing admin alert status');
        await AdminAlertService.markAsReadByReference('contact_message', messageId).catch(err => {
            logger.error({ err, messageId }, 'Failed to clear admin alert on message view');
        });

        res.json({
            success: true,
            data: message
        });
    } catch (error) {
        logger.error({ err: error, id: req.params.id }, 'Error fetching contact message detail:');
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
