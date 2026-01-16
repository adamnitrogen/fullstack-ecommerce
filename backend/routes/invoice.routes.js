const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const supabase = require('../config/supabase');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { createInvoice, fetchInvoice } = require('../services/razorpay-invoice.service');

// Apply authentication
router.use(authenticateToken);

/**
 * GET /api/invoices/orders/:id
 * Get invoice details/URL for an order
 */
router.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Fetch order to check ownership or admin role
        const { data: order, error } = await supabase
            .from('orders')
            .select('id, user_id, invoice_id, invoice_url, invoice_number')
            .eq('id', id)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check permission (Admin/Manager or Order Owner)
        const isOwner = order.user_id === userId;
        const canAccess = isOwner || req.user.roles?.some(r => ['admin', 'manager'].includes(r));

        if (!canAccess) {
            return res.status(403).json({ error: 'Unauthorized access to invoice' });
        }

        if (order.invoice_url) {
            return res.json({
                invoice_id: order.invoice_id,
                invoice_url: order.invoice_url,
                invoice_number: order.invoice_number
            });
        }

        // If invoice_id exists but no URL (rare), try to fetch from Razorpay
        if (order.invoice_id) {
            const result = await fetchInvoice(order.invoice_id);
            if (result.success) {
                // Update DB with URL if found
                await supabase
                    .from('orders')
                    .update({ invoice_url: result.invoiceUrl })
                    .eq('id', id);

                return res.json({
                    invoice_id: order.invoice_id,
                    invoice_url: result.invoiceUrl,
                    invoice_number: result.invoice.invoice_number
                });
            }
        }

        return res.status(404).json({ error: 'Invoice not generated for this order' });

    } catch (error) {
        logger.error({ err: error }, 'Error fetching invoice');
        res.status(500).json({ error: 'Failed to fetch invoice details' });
    }
});

const { FinancialEventLogger, FINANCIAL_EVENTS } = require('../services/financial-event-logger.service');

// ... imports

/**
 * POST /api/invoices/orders/:id/retry
 * Retry invoice generation for an order (Admin Only)
 */
router.post('/orders/:id/retry', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch full order details with items
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    product:products(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.invoice_id && order.invoice_url) {
            return res.json({
                message: 'Invoice already exists',
                invoice_url: order.invoice_url
            });
        }

        // Log the admin attempt
        await FinancialEventLogger.logAdminStatusUpdate(
            'order',
            id,
            'invoice_failed', // roughly the previous state conceptually
            'invoice_retrying',
            req.user.id,
            'Manual invoice retry initiated by admin'
        );

        const invoiceResult = await createInvoice({
            paymentId: order.payment_id,
            amount: order.total_amount,
            customerName: order.customer_name || 'Customer',
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            receiptNumber: order.order_number,
            description: `Invoice for Order ${order.order_number}`,
            lineItems: null // Service handles default item creation
        });

        if (invoiceResult.success) {
            await supabase
                .from('orders')
                .update({
                    invoice_id: invoiceResult.invoiceId,
                    invoice_url: invoiceResult.invoiceUrl,
                    invoice_number: invoiceResult.invoiceNumber
                })
                .eq('id', id);

            // Log success event
            await FinancialEventLogger.logInvoiceGenerated(
                id,
                invoiceResult.invoiceId,
                invoiceResult.invoiceNumber,
                invoiceResult.invoiceUrl
            );

            return res.json({
                success: true,
                message: 'Invoice generated successfully',
                invoice_url: invoiceResult.invoiceUrl
            });
        } else {
            // Log failure event
            await FinancialEventLogger.logInvoiceFailed(id, invoiceResult.error, (order.invoice_retry_count || 0) + 1);

            return res.status(400).json({ error: invoiceResult.error });
        }

    } catch (error) {
        logger.error({ err: error }, 'Error retrying invoice generation');
        res.status(500).json({ error: 'Internal server error during invoice generation' });
    }
});

module.exports = router;
