/**
 * Invoice Orchestrator Service
 * Manages Razorpay GST invoice lifecycle: creation, retrieval, and status tracking
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');
const { getTraceContext } = require('../utils/async-context');
const RazorpayInvoiceService = require('./razorpay-invoice.service');
const { FinancialEventLogger } = require('./financial-event-logger.service');
const emailService = require('./email');
const { PricingCalculator } = require('./pricing-calculator.service');

const log = createModuleLogger('InvoiceOrchestrator');

// Invoice status constants
const INVOICE_STATUS = {
    PENDING: 'pending',
    GENERATED: 'generated',
    FAILED: 'failed'
};

class InvoiceOrchestrator {
    /**
     * Generate GST invoice for a delivered order
     * Called when order status changes to 'delivered'
     * @param {string} orderId - Order UUID
     * @returns {Object} Invoice result
     */
    static async generateInvoiceForOrder(orderId) {
        log.operationStart('GENERATE_INVOICE', { orderId });
        const startTime = Date.now();

        try {
            // 1. Fetch order with items and user profile
            const { data: order, error: fetchError } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (*),
                    profiles:user_id (
                        id,
                        name,
                        email,
                        phone
                    )
                `)
                .eq('id', orderId)
                .single();

            if (fetchError || !order) {
                throw new Error(`Order not found: ${orderId}`);
            }

            // Check if invoice already exists
            if (order.invoice_id) {
                log.info('INVOICE_EXISTS', 'Invoice already generated for order', {
                    orderId,
                    invoiceId: order.invoice_id
                });
                return {
                    success: true,
                    invoiceId: order.invoice_id,
                    invoiceUrl: order.invoice_url,
                    alreadyExists: true
                };
            }

            // Mark as pending
            await supabase
                .from('orders')
                .update({ invoice_status: INVOICE_STATUS.PENDING })
                .eq('id', orderId);

            // 2. Prepare invoice data for Razorpay
            const invoiceData = this._prepareInvoiceData(order);

            // 3. Create invoice via Razorpay
            const invoice = await RazorpayInvoiceService.createInvoice(invoiceData);

            // 4. Update order with invoice reference
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    invoice_url: invoice.short_url,
                    invoice_status: INVOICE_STATUS.GENERATED,
                    invoice_generated_at: new Date().toISOString()
                })
                .eq('id', orderId);

            if (updateError) {
                log.warn('INVOICE_UPDATE_ERROR', 'Failed to update order with invoice reference', {
                    orderId,
                    invoiceId: invoice.id
                });
            }

            // 5. Log financial event
            await FinancialEventLogger.logInvoiceGenerated(
                orderId,
                invoice.id,
                invoice.invoice_number,
                invoice.short_url
            );

            // 6. Send GST Invoice email to customer
            if (order.profiles?.email) {
                const taxBreakdown = {
                    totalTaxableAmount: order.total_taxable_amount,
                    totalCgst: order.total_cgst,
                    totalSgst: order.total_sgst,
                    totalIgst: order.total_igst,
                    totalTax: (order.total_cgst || 0) + (order.total_sgst || 0) + (order.total_igst || 0),
                    taxType: order.total_igst > 0 ? 'INTER' : 'INTRA'
                };

                emailService.send('GST_INVOICE_GENERATED', order.profiles.email, {
                    customerName: order.profiles.name,
                    order: {
                        id: orderId,
                        order_number: order.order_number,
                        total_amount: order.totalAmount,
                        order_items: order.order_items
                    },
                    invoiceUrl: invoice.short_url,
                    taxBreakdown
                }, order.user_id, orderId)
                    .catch(err => log.warn('EMAIL_ERROR', 'Failed to send invoice email', { error: err.message }));
            }

            log.operationSuccess('GENERATE_INVOICE', {
                orderId,
                invoiceId: invoice.id,
                invoiceUrl: invoice.short_url
            }, Date.now() - startTime);

            return {
                success: true,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoice_number,
                invoiceUrl: invoice.short_url
            };

        } catch (error) {
            log.operationError('GENERATE_INVOICE', error, { orderId });

            // Mark as failed
            await supabase
                .from('orders')
                .update({ invoice_status: INVOICE_STATUS.FAILED })
                .eq('id', orderId);

            // Log failure for retry
            await FinancialEventLogger.logInvoiceFailed(orderId, error, 0);

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Prepare invoice data for Razorpay API
     */
    static _prepareInvoiceData(order) {
        const profile = order.profiles || {};
        const shippingAddress = order.shippingAddress || {};

        // Format line items with GST
        const lineItems = (order.order_items || []).map(item => {
            const lineItem = {
                name: item.title || 'Product',
                description: item.variant_snapshot?.description || '',
                amount: Math.round((item.taxable_amount || item.price_per_unit * item.quantity) * 100), // In paisa
                currency: 'INR',
                quantity: item.quantity || 1
            };

            // Add GST details if applicable
            if (item.gst_rate && item.gst_rate > 0) {
                lineItem.hsn_code = item.hsn_code || undefined;
                lineItem.tax_rate = item.gst_rate;

                if (item.igst > 0) {
                    lineItem.igst = Math.round(item.igst * 100);
                } else {
                    lineItem.cgst = Math.round((item.cgst || 0) * 100);
                    lineItem.sgst = Math.round((item.sgst || 0) * 100);
                }
            }

            return lineItem;
        });

        return {
            type: 'invoice',
            customer: {
                name: profile.name || order.customerName || 'Customer',
                email: profile.email || order.customerEmail,
                contact: profile.phone || order.customerPhone,
                billing_address: {
                    line1: shippingAddress.street || shippingAddress.line1 || '',
                    line2: shippingAddress.apartment || '',
                    zipcode: shippingAddress.pincode || shippingAddress.zip || '',
                    city: shippingAddress.city || '',
                    state: shippingAddress.state || '',
                    country: 'in'
                }
            },
            line_items: lineItems,
            sms_notify: 0,
            email_notify: 0, // We send our own email
            currency: 'INR',
            receipt: order.order_number,
            notes: {
                order_id: order.id,
                order_number: order.order_number,
                correlationId: getTraceContext().correlationId
            }
        };
    }

    /**
     * Retry failed invoice generation
     * Called by background job
     */
    static async retryFailedInvoices() {
        log.operationStart('RETRY_FAILED_INVOICES');

        const { data: failedOrders, error } = await supabase
            .from('orders')
            .select('id')
            .eq('status', 'delivered')
            .eq('invoice_status', INVOICE_STATUS.FAILED)
            .is('invoice_id', null)
            .limit(10);

        if (error) {
            log.operationError('RETRY_FAILED_INVOICES', error);
            return { processed: 0 };
        }

        let successCount = 0;
        for (const order of failedOrders || []) {
            const result = await this.generateInvoiceForOrder(order.id);
            if (result.success) successCount++;
        }

        log.operationSuccess('RETRY_FAILED_INVOICES', {
            attempted: failedOrders?.length || 0,
            successful: successCount
        });

        return {
            processed: failedOrders?.length || 0,
            successful: successCount
        };
    }

    /**
     * Get invoice status for an order
     */
    static async getInvoiceStatus(orderId) {
        const { data, error } = await supabase
            .from('orders')
            .select('invoice_id, invoice_number, invoice_url, invoice_status, invoice_generated_at')
            .eq('id', orderId)
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = {
    InvoiceOrchestrator,
    INVOICE_STATUS
};
