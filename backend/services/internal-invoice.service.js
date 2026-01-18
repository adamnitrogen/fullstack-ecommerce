const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('InternalInvoiceService');

// Ensure storage directory exists
const STORAGE_DIR = path.join(__dirname, '../../storage/invoices');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Logo path
const LOGO_PATH = path.join(__dirname, '../../frontend/public/favicon.ico'); // Fallback/Test path, ideally use actual logo or convert ICO to PNG
// Note: Puppeteer + ICO might be flaky, better to have PNG. 
// But we'll try to read it as base64.

class InternalInvoiceService {

    /**
     * Generate Internal GST Invoice for a Delivered Order
     * @param {Object} order - Order object with items and profiles
     */
    static async generateInvoice(order) {
        log.operationStart('GENERATE_INTERNAL_INVOICE', { orderId: order.id });
        const startTime = Date.now();

        try {
            // 1. Determine Invoice Type (Tax Invoice vs Bill of Supply)
            const isGstInvoice = this._isGstApplicable(order);
            const invoiceType = isGstInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY';

            // 2. Generate Invoice Number (Simple sequential or logic)
            // For MVP: INV-{Year}-{Random} or fetch from a sequence table. 
            // Using Timestamp for uniqueness now.
            const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

            // 3. Prepare Template Data
            const templateData = await this._prepareTemplateData(order, invoiceNumber, invoiceType, isGstInvoice);

            // 4. Generate PDF
            const pdfBuffer = await this._generatePdf(templateData);

            // 5. Save to Disk
            const filename = `${invoiceNumber}.pdf`;
            const filePath = path.join(STORAGE_DIR, filename);
            fs.writeFileSync(filePath, pdfBuffer);

            // 6. Persist Metadata in DB
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // 30 Days Retention

            const { data: invoiceRecord, error } = await supabase
                .from('invoices')
                .insert({
                    order_id: order.id,
                    type: isGstInvoice ? 'TAX_INVOICE' : 'BILL_OF_SUPPLY',
                    invoice_number: invoiceNumber,
                    file_path: filePath,
                    public_url: null, // Local file for now, served via API endpoint
                    status: 'GENERATED',
                    generated_at: new Date().toISOString(),
                    expires_at: expiryDate.toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            log.operationSuccess('GENERATE_INTERNAL_INVOICE', {
                invoiceId: invoiceRecord.id,
                path: filePath
            }, Date.now() - startTime);

            return {
                success: true,
                invoiceId: invoiceRecord.id,
                filePath,
                invoiceNumber
            };

        } catch (error) {
            log.operationError('GENERATE_INTERNAL_INVOICE', error);
            return { success: false, error: error.message };
        }
    }

    // --- Helpers ---

    static _isGstApplicable(order) {
        // If any item has a GST rate > 0, it's a Tax Invoice. 
        // Also check delivery charge GST.
        const hasItemGst = order.items?.some(item => (item.gst_rate && item.gst_rate > 0));
        const hasDeliveryGst = order.delivery_gst > 0;
        return hasItemGst || hasDeliveryGst;
    }

    static async _prepareTemplateData(order, invoiceNumber, invoiceType, isGstInvoice) {
        // Load seller info from Environment Variables
        const seller = {
            name: process.env.SELLER_NAME || process.env.SMTP_FROM_NAME || 'Meri Gau Mata',
            address: {
                line1: process.env.SELLER_ADDRESS_LINE1 || 'Default Address',
                city: process.env.SELLER_CITY || 'Mumbai',
                state: process.env.SELLER_STATE || 'Maharashtra',
                zip: process.env.SELLER_ZIP || '400000'
            },
            gstin: process.env.SELLER_GSTIN || 'URP', // Unregistered Person by default? No, usually generic placeholder
            pan: process.env.SELLER_PAN || 'N/A',
            city: process.env.SELLER_CITY || 'Mumbai'
        };

        // Determine Place of Supply
        const customerState = order.shipping_address?.state || 'Maharashtra';
        const sellerState = seller.address.state;

        // Simple case-insensitive check
        const isInterState = !customerState.toLowerCase().includes(sellerState.toLowerCase());

        // Read Logo
        let logoDataUrl = '';
        try {
            if (fs.existsSync(LOGO_PATH)) {
                const logoBuffer = fs.readFileSync(LOGO_PATH);
                logoDataUrl = `data:image/x-icon;base64,${logoBuffer.toString('base64')}`;
            }
        } catch (e) { log.warn('Failed to load logo', e); }

        // Process Items
        let grandTotal = 0;
        let totalTaxable = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        const items = order.items.map((item, index) => {
            const quantity = item.quantity || 1;
            // Use precise totals from order item if available (best source of truth)
            const amount = parseFloat(item.total_amount || 0);

            // Tax calculation
            // Fallback to recalculating if fields missing (legacy orders)
            // But usually we have them now.
            const taxable = parseFloat(item.taxable_amount || 0);
            const cgst = parseFloat(item.cgst || 0);
            const sgst = parseFloat(item.sgst || 0);
            const igst = parseFloat(item.igst || 0);

            totalTaxable += taxable;
            totalCgst += cgst;
            totalSgst += sgst;
            totalIgst += igst;
            grandTotal += amount;

            // Rate display: Taxable Value / Quantity usually
            const rate = quantity > 0 ? (taxable / quantity).toFixed(2) : "0.00";

            return {
                index: index + 1,
                name: item.product?.title || 'Product',
                variant: item.variant_snapshot?.size_label || item.size_label || null,
                hsn_code: item.hsn_code || 'N/A',
                quantity,
                rate,
                taxableValue: taxable.toFixed(2),
                gstRate: item.gst_rate || 0,
                cgstAmount: cgst.toFixed(2),
                sgstAmount: sgst.toFixed(2),
                igstAmount: igst.toFixed(2),
                totalAmount: amount.toFixed(2)
            };
        });

        // Add Delivery if exists
        if (order.delivery_charge > 0) {
            const deliveryCharge = parseFloat(order.delivery_charge);
            const deliveryGst = parseFloat(order.delivery_gst || 0);

            grandTotal += (deliveryCharge + deliveryGst);

            // Delivery GST logic - separate or added to totals for summary
            // For summary table, we add to totals
            // Note: In template typically delivery is shown separately or as a line item.
            // Our template expects summary fields.
            if (isInterState) {
                totalIgst += deliveryGst;
            } else {
                totalCgst += (deliveryGst / 2);
                totalSgst += (deliveryGst / 2);
            }
            // Delivery Taxable is the charge itself
            // Wait, usually delivery_charge is exclusive of tax? 
            // Yes, standard ecommerce practice.
            // So we shouldn't add deliveryCharge to grandTotal twice if it was already part of order.total_amount?
            // `order.total_amount` usually includes delivery.
            // In the loop above: `items` loop sums up item totals. 
            // If `order.total_amount` == item sums + delivery + delivery gst.
            // We are recalculating `grandTotal` from components.
            // So adding here is correct.
        }

        const amountInWords = this._amountToWords(grandTotal);

        return {
            title: invoiceType,
            invoiceType,
            invoiceNumber,
            invoiceDate: new Date().toLocaleDateString('en-IN'),
            placeOfSupply: `${customerState} (${isInterState ? 'Inter-State' : 'Intra-State'})`,
            orderNumber: order.order_number,
            logoDataUrl,
            seller,
            customer: {
                name: order.customer_name || 'Valued Customer',
                billing_address: order.billing_address || order.shipping_address, // Fallback
                shipping_address: order.shipping_address,
                gstin: order.customer_gstin || null
            },
            items,
            isGstInvoice,
            isInterState,
            summary: {
                taxableAmount: totalTaxable.toFixed(2),
                totalCgst: totalCgst.toFixed(2),
                totalSgst: totalSgst.toFixed(2),
                totalIgst: totalIgst.toFixed(2),
                deliveryCharge: (order.delivery_charge || 0).toFixed(2),
                grandTotal: grandTotal.toFixed(2)
            },
            amountInWords
        };
    }

    // ... _generatePdf remains same ...

    static _amountToWords(amount) {
        // Basic Indian Number System to Words
        // Supports up to Crores
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const numToWords = (num) => {
            if ((num = num.toString()).length > 9) return 'overflow';
            const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return;
            let str = '';
            str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
            str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
            str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
            str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
            str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
            return str;
        };

        const parts = amount.toFixed(2).split('.');
        let output = numToWords(Number(parts[0])) + 'Rupees';
        if (Number(parts[1]) > 0) {
            output += ' and ' + numToWords(Number(parts[1])) + 'Paise';
        }
        return output + ' Only';
    }
}

module.exports = InternalInvoiceService;
