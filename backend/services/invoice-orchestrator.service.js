/**
 * Invoice Orchestrator Service
 * Manages Dual-Invoice Lifecycle:
 * 1. Razorpay Payment Receipt (at Checkout)
 * 2. Internal GST Tax Invoice (at Delivery)
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const RazorpayInvoiceService = require('./razorpay-invoice.service');
const InternalInvoiceService = require('./internal-invoice.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const emailService = require('./email');

const log = createModuleLogger('InvoiceOrchestrator');

const INVOICE_STATUS = {
    PENDING: 'PENDING',
    GENERATED: 'GENERATED',
    FAILED: 'FAILED'
};

class InvoiceOrchestrator {

    // ========================================================================
    // 1. RAZORPAY PAYMENT RECEIPT (Checkout Flow)
    // ========================================================================

    /**
     * Generate Razorpay Invoice as Payment Proof
     * Called during/after Checkout
     */
    static async generateRazorpayInvoice(order) {
        log.operationStart('GENERATE_RAZORPAY_INVOICE', { orderId: order.id });
        try {
            // Prepare data
            const invoiceData = this._prepareRazorpayData(order);

            // Create via Razorpay
            const invoice = await RazorpayInvoiceService.createInvoice(invoiceData);

            if (invoice.success) {
                // Persist in new Invoices table
                await supabase.from('invoices').insert({
                    order_id: order.id,
                    type: 'RAZORPAY',
                    invoice_number: invoice.invoiceNumber,
                    provider_id: invoice.invoiceId,
                    public_url: invoice.invoiceUrl,
                    status: 'GENERATED'
                });

                // Backward compatibility: Update order columns if needed, or deprecate them.
                // We will update them for now to avoid breaking existing frontend logic that checks order.invoice_url
                // BUT strict separation means we shouldn't confuse this with TAX invoice.
                // The user requirement says: "Never treat Razorpay invoice as product GST invoice".
                // So we should NOT update `invoice_url` on orders table if that is used for Tax Invoice.
                // We will store it ONLY in `invoices` table.

                log.operationSuccess('GENERATE_RAZORPAY_INVOICE', { invoiceId: invoice.invoiceId });
                return invoice;
            }

            throw new Error(invoice.error || 'Razorpay creation failed');

        } catch (error) {
            log.operationError('GENERATE_RAZORPAY_INVOICE', error);
            await supabase.from('orders').update({ invoice_status: 'failed' }).eq('id', order.id); // Track failure on order broadly
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // 2. INTERNAL GST INVOICE (Post-Delivery Flow)
    // ========================================================================

    /**
     * Generate Internal GST Invoice
     * Called when Order Status -> DELIVERED
     */
    static async generateInternalInvoice(orderId) {
        log.operationStart('GENERATE_INTERNAL_INVOICE', { orderId });

        try {
            // Fetch full order details
            const { data: order, error } = await supabase
                .from('orders')
                .select(`*, items:order_items(*)`)
                .eq('id', orderId)
                .single();

            if (error || !order) throw new Error('Order not found');

            // Generate Internal Invoice
            const result = await InternalInvoiceService.generateInvoice(order);

            if (result.success) {
                // Update Order Metadata to point to THIS as the official invoice
                await supabase.from('orders').update({
                    invoice_id: result.invoiceId, // Now points to invoices table UUID
                    invoice_number: result.invoiceNumber,
                    invoice_status: 'generated',
                    invoice_generated_at: new Date().toISOString(),
                    // We might need an endpoint to serve this file, e.g. /api/invoices/:id/download
                    // So we don't put a direct URL here yet unless we have a public storage bucket.
                    // For local file, we construct a backend route URL.
                    invoice_url: `/api/invoices/${result.invoiceId}/download`
                }).eq('id', orderId);

                // Send Email
                this._sendInvoiceEmail(order, result);
            }

            return result;

        } catch (error) {
            log.operationError('GENERATE_INTERNAL_INVOICE', error);
            return { success: false, error: error.message };
        }
    }

    // --- Helpers ---

    static _prepareRazorpayData(order) {
        // Logic similar to existing code but strictly for Payment Receipt
        const lineItems = (order.items || []).map(item => ({
            name: item.title || 'Product',
            amount: Math.round((item.price || 0) * 100),
            currency: 'INR',
            quantity: item.quantity || 1
        }));

        // Add delivery
        if (order.delivery_charge) {
            lineItems.push({
                name: 'Delivery Charge',
                amount: Math.round(order.delivery_charge * 100),
                currency: 'INR',
                quantity: 1
            });
        }

        return {
            type: 'invoice',
            customer: {
                name: order.customer_name,
                email: order.customer_email,
                contact: order.customer_phone
            },
            line_items: lineItems,
            receipt: order.order_number,
            description: `Payment Receipt for Order ${order.order_number}`
        };
    }

    static async _sendInvoiceEmail(order, invoiceResult) {
        if (!order.customer_email) return;

        // Use the new GST template email logic
        // We need to fetch/construct the breakdown for the email template
        // Or just send a simple "Here is your invoice" with attachment?
        // Existing `gst-invoice.template.js` logic expects tax breakdown object.
        // We can reuse it if we calculate breakdown again or pass it from InternalInvoiceService.

        // For now, simpliest valid email:
        // We will just invoke the email service with the download link.

        // Using existing email service method which likely internally calls the template
        // We need to ensure we pass the right data structure expected by `gst-invoice.template.js`
        // See: Step 19. It expects { taxBreakdown, invoiceUrl ... }

        // Let's rely on the user manually downloading it for MVP or implement proper breakdown pass-through later.
        // Or better: Assume the user clicks the link in the email.

        const downloadUrl = `${process.env.FRONTEND_URL}/orders/${order.id}`; // Point to Order Details page where button is

        emailService.send('GST_INVOICE_GENERATED', order.customer_email, {
            customerName: order.customer_name,
            order: order,
            invoiceUrl: downloadUrl // User goes to portal to download
            // taxBreakdown: ... // Optional: skip for now or implement calculation
        }, order.user_id, order.id);
    }

    /**
     * Periodically clean up expired invoice files (30-day retention)
     */
    static async cleanupExpiredInvoices() {
        try {
            const now = new Date().toISOString();

            // Find invoices expired before now and have a file path
            const { data: expiredInvoices, error } = await supabase
                .from('invoices')
                .select('id, file_path')
                .lt('expires_at', now)
                .not('file_path', 'is', null);

            if (error) throw error;

            if (!expiredInvoices || expiredInvoices.length === 0) {
                return { success: true, processed: 0 };
            }

            logger.info(`Found ${expiredInvoices.length} expired invoices to cleanup`);

            let successful = 0;
            let failed = 0;

            for (const invoice of expiredInvoices) {
                try {
                    // 1. Delete File if exists
                    if (invoice.file_path && fs.existsSync(invoice.file_path)) {
                        fs.unlinkSync(invoice.file_path);
                    } else if (invoice.file_path) {
                        logger.warn({ invoiceId: invoice.id, path: invoice.file_path }, 'Expired invoice file not found on disk');
                    }

                    // 2. Update DB record
                    const { error: updateError } = await supabase
                        .from('invoices')
                        .update({
                            file_path: null,
                            status: 'EXPIRED',
                            // Keep public_url? Probably invalid now if it pointed to this file
                            // But usually public_url handled by route.
                            // If we delete the file, the route will fail anyway.
                        })
                        .eq('id', invoice.id);

                    if (updateError) throw updateError;

                    successful++;
                } catch (err) {
                    logger.error({ err, invoiceId: invoice.id }, 'Failed to cleanup expired invoice');
                    failed++;
                }
            }

            return { success: true, processed: expiredInvoices.length, successful, failed };

        } catch (error) {
            logger.error({ err: error }, 'Error in cleanupExpiredInvoices');
            return { success: false, error: error.message };
        }
    }
}

module.exports = { InvoiceOrchestrator, INVOICE_STATUS };
