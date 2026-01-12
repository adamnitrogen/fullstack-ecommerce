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
async function createInvoice({
    paymentId,
    amount, // Total amount in rupees
    customerName,
    customerEmail,
    customerPhone,
    description,
    receiptNumber,
    lineItems = null // Optional array of items { name, amount, currency, quantity }
}) {
    try {
        logger.info({ paymentId }, 'Creating Razorpay invoice');

        // Prepare line items
        let finalLineItems = [];
        if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
            // Use provided line items (e.g. from product order)
            finalLineItems = lineItems;
        } else {
            // Fallback: Create single item from total amount (e.g. for event registration)
            finalLineItems = [{
                name: description || 'Payment',
                amount: Math.round(amount * 100), // Convert to paisa
                currency: 'INR',
                quantity: 1
            }];
        }

        // Create invoice with minimal required fields
        const invoiceData = {
            type: 'invoice',
            description: description || `Payment for ${receiptNumber}`,
            customer: {
                name: customerName,
                email: customerEmail,
                contact: customerPhone ? String(customerPhone).replace(/\D/g, '') : undefined
            },
            line_items: finalLineItems,
            currency: 'INR',
            sms_notify: 0,
            email_notify: 0, // We send our own email
            receipt: receiptNumber || `RCP-${Date.now()}`,
            notes: {
                payment_id: paymentId
            }
        };

        logger.debug({ lineItemsCount: finalLineItems.length }, 'Invoice data prepared');

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
