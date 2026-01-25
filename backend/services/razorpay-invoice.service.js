/**
 * Razorpay Invoice Service
 * Handles GST invoice generation via Razorpay Invoice API
 * 
 * REQUIREMENTS:
 * - "Invoices" must be enabled in Razorpay Dashboard (Products → Invoices)
 * - Your Razorpay account must be activated (not just test mode)
 */

const Razorpay = require('razorpay');
const logger = require('../utils/logger');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create an invoice for a payment
 * Using minimal required fields for maximum compatibility
 */
/**
 * Create an invoice for a payment
 * Supports both:
 * 1. Raw Payload (from InvoiceOrchestrator) - { type: 'invoice', customer: {...}, line_items: [...] }
 * 2. Legacy Params - { paymentId, amount, customerName... }
 */
async function createInvoice(data) {
    try {
        let invoiceData;

        // Check if input is a pre-built Razorpay payload (from InvoiceOrchestrator)
        if (data.type === 'invoice' && (data.line_items || data.customer)) {
            logger.debug('Using raw invoice payload');
            invoiceData = { ...data };
        } else {
            // Legacy/Simple Mode: Construct payload from params
            const {
                paymentId, amount, customerName, customerEmail,
                customerPhone, description, receiptNumber, lineItems
            } = data;

            logger.info({ paymentId }, 'Creating Razorpay invoice (Legacy Mode)');

            let finalLineItems = [];
            if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
                finalLineItems = lineItems;
            } else {
                finalLineItems = [{
                    name: description || 'Payment',
                    amount: Math.round(amount * 100),
                    currency: 'INR',
                    quantity: 1
                }];
            }

            invoiceData = {
                type: 'invoice',
                description: description || `Payment for ${receiptNumber}`,
                customer: {
                    name: customerName,
                    email: customerEmail,
                    contact: customerPhone ? String(customerPhone).replace(/\D/g, '') : undefined
                },
                line_items: finalLineItems,
                currency: 'INR',
                receipt: receiptNumber || `RCP-${Date.now()}`,
                notes: {
                    payment_id: paymentId
                }
            };
        }

        // FORCE disable notifications to prevent confusing "Pay Now" emails
        // We handle notifications via our own EmailService
        invoiceData.sms_notify = 0;
        invoiceData.email_notify = 0;

        logger.debug({
            lines: invoiceData.line_items?.length,
            customer: invoiceData.customer?.name
        }, 'Invoice data prepared');

        // Create the invoice
        const invoice = await razorpay.invoices.create(invoiceData);
        logger.info({ invoiceId: invoice.id, status: invoice.status }, 'Invoice created');

        // Get the final invoice - it may already be issued
        let finalInvoice = invoice;

        // Only try to issue if in draft status
        if (invoice.status === 'draft') {
            try {
                finalInvoice = await razorpay.invoices.issue(invoice.id);
                logger.info({ invoiceId: finalInvoice.id }, 'Invoice issued');
            } catch (issueError) {
                // If already issued, fetch the latest invoice
                logger.debug('Issue step skipped, fetching invoice');
                finalInvoice = await razorpay.invoices.fetch(invoice.id);
            }
        }

        logger.info({ invoiceId: finalInvoice.id }, 'Invoice ready');

        return {
            success: true,
            invoiceId: finalInvoice.id,
            orderId: finalInvoice.order_id, // Added to support automatic status updates
            invoiceUrl: finalInvoice.short_url,
            invoiceNumber: finalInvoice.invoice_number
        };

    } catch (error) {
        logger.error({ err: error.message }, '[RazorpayInvoice] Failed to create invoice:');

        // Log full error details for debugging
        if (error.error) {
            logger.error({ err: error.error.code }, '[RazorpayInvoice] Error code:');
            logger.error({ err: error.error.description }, '[RazorpayInvoice] Error description:');
            logger.error({ err: error.error.field }, '[RazorpayInvoice] Error field:');
        }

        // Return failure but don't block the main flow
        return {
            success: false,
            error: error.error?.description || error.message || 'Invoice creation failed'
        };
    }
}

/**
 * Fetch invoice by ID
 */
async function fetchInvoice(invoiceId) {
    try {
        const invoice = await razorpay.invoices.fetch(invoiceId);
        return {
            success: true,
            invoice,
            invoiceUrl: invoice.short_url
        };
    } catch (error) {
        logger.error({ err: error.message }, '[RazorpayInvoice] Failed to fetch invoice:');
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    createInvoice,
    fetchInvoice
};
