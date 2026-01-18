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

            // 5. Upload to Supabase Storage (and save local backup)
            const filename = `${invoiceNumber}.pdf`;
            const filePath = path.join(STORAGE_DIR, filename);
            fs.writeFileSync(filePath, pdfBuffer);

            // Upload to Storage
            const publicUrl = await this._uploadToStorage(filename, pdfBuffer);

            // 6. Persist Metadata in DB
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // 30 Days Retention

            const { data: invoiceRecord, error } = await supabase
                .from('invoices')
                .insert({
                    order_id: order.id,
                    type: isGstInvoice ? 'TAX_INVOICE' : 'BILL_OF_SUPPLY',
                    invoice_number: invoiceNumber,
                    file_path: filePath, // Keep local ref for now
                    public_url: publicUrl, // Store public URL
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
                invoiceNumber,
                publicUrl: invoiceRecord.public_url
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

        // Initialize Totals
        let grandTotal = 0;
        let totalTaxable = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        // Collect All Product Items
        const items = order.items.map((item, index) => {
            const quantity = item.quantity || 1;
            const amount = parseFloat(item.total_amount || 0);
            const taxable = parseFloat(item.taxable_amount || 0);
            const cgst = parseFloat(item.cgst || 0);
            const sgst = parseFloat(item.sgst || 0);
            const igst = parseFloat(item.igst || 0);

            totalTaxable += taxable;
            totalCgst += cgst;
            totalSgst += sgst;
            totalIgst += igst;
            grandTotal += amount;

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

        // Add Delivery Charges to Totals (Transparently)
        const deliveryBase = order.delivery_charge || 0;
        const deliveryGst = order.delivery_gst || 0;

        if (deliveryBase > 0 || deliveryGst > 0) {
            grandTotal += (deliveryBase + deliveryGst);
            if (isInterState) {
                totalIgst += deliveryGst;
            } else {
                totalCgst += (deliveryGst / 2);
                totalSgst += (deliveryGst / 2);
            }
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
                billing_address: order.billing_address || order.shipping_address,
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
                deliveryCharge: deliveryBase.toFixed(2),
                grandTotal: grandTotal.toFixed(2)
            },
            amountInWords
        };
    }

    /**
     * Generate PDF Buffer using Puppeteer
     */
    static async _generatePdf(data) {
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        try {
            const page = await browser.newPage();

            // Compile Template
            const templateHtml = `
            <!DOCTYPE html>
            <html>
            <head>
            <style>
              body { font-family: Helvetica, sans-serif; padding: 40px; color: #333; }
              .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
              .company-info h3 { margin: 0 0 5px 0; font-size: 20px; color: #000; }
              .company-info p { margin: 0; font-size: 12px; color: #555; }
              .invoice-title { font-size: 24px; font-weight: bold; text-align: right; color: #444; }
              .invoice-details { text-align: right; font-size: 13px; margin-top: 10px; }
              .invoice-details p { margin: 2px 0; }
              
              .bill-to { margin-bottom: 30px; }
              .bill-to h4 { margin: 0 0 5px 0; font-size: 14px; text-transform: uppercase; color: #666; }
              .bill-to p { margin: 0; font-size: 14px; }

              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #f8f9fa; border-bottom: 2px solid #ddd; padding: 10px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #555; }
              td { border-bottom: 1px solid #eee; padding: 10px; text-align: left; font-size: 13px; }
              td.right { text-align: right; }
              th.right { text-align: right; }
              
              .totals { margin-top: 30px; float: right; width: 40%; }
              .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
              .grand-total { font-weight: bold; font-size: 16px; border-top: 2px solid #333; border-bottom: 2px solid #333; padding: 10px 0; margin-top: 10px; }
              
              .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
            </head>
            <body>
              <div class="header">
                <div class="company-info">
                    <h3>{{seller.name}}</h3>
                    <p>{{seller.address.line1}}</p>
                    <p>{{seller.address.city}}, {{seller.address.state}} - {{seller.address.zip}}</p>
                    <p><strong>GSTIN:</strong> {{seller.gstin}}</p>
                </div>
                <div>
                    <div class="invoice-title">{{title}}</div>
                    <div class="invoice-details">
                        <p><strong>Invoice No:</strong> {{invoiceNumber}}</p>
                        <p><strong>Date:</strong> {{invoiceDate}}</p>
                        <p><strong>Place of Supply:</strong> {{placeOfSupply}}</p>
                    </div>
                </div>
              </div>

              <div class="bill-to">
                  <h4>Bill To</h4>
                  <p><strong>{{customer.name}}</strong></p>
                  {{#if customer.shipping_address}}
                  <p>{{customer.shipping_address.address_line1}}, {{customer.shipping_address.city}}</p>
                  <p>{{customer.shipping_address.state}} - {{customer.shipping_address.pincode}}</p>
                  {{/if}}
                  {{#if customer.gstin}}
                  <p><strong>GSTIN:</strong> {{customer.gstin}}</p>
                  {{/if}}
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 5%">#</th>
                    <th style="width: 35%">Item</th>
                    <th style="width: 10%">HSN</th>
                    <th style="width: 5%">Qty</th>
                    <th class="right" style="width: 10%">Rate</th>
                    <th class="right" style="width: 15%">Taxable</th>
                    {{#if isInterState}}
                    <th class="right" style="width: 10%">IGST</th>
                    {{else}}
                    <th class="right" style="width: 10%">CGST%</th>
                    <th class="right" style="width: 10%">SGST%</th>
                    {{/if}}
                    <th class="right" style="width: 10%">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {{#each items}}
                  <tr>
                    <td>{{index}}</td>
                    <td>{{name}} {{#if variant}}<br><small class="text-muted">({{variant}})</small>{{/if}}</td>
                    <td>{{hsn_code}}</td>
                    <td>{{quantity}}</td>
                    <td class="right">{{rate}}</td>
                    <td class="right">{{taxableValue}}</td>
                    {{#if ../isInterState}}
                    <td class="right">{{igstAmount}}</td>
                    {{else}}
                    <td class="right">{{cgstAmount}}</td>
                    <td class="right">{{sgstAmount}}</td>
                    {{/if}}
                    <td class="right">{{totalAmount}}</td>
                  </tr>
                  {{/each}}
                </tbody>
              </table>

              <div class="totals">
                  <div class="totals-row"><span>Taxable Amount:</span> <span>{{summary.taxableAmount}}</span></div>
                  {{#if isInterState}}
                  <div class="totals-row"><span>Total IGST:</span> <span>{{summary.totalIgst}}</span></div>
                  {{else}}
                  <div class="totals-row"><span>Total CGST:</span> <span>{{summary.totalCgst}}</span></div>
                  <div class="totals-row"><span>Total SGST:</span> <span>{{summary.totalSgst}}</span></div>
                  {{/if}}
                  {{#if summary.deliveryCharge}}
                  <div class="totals-row"><span>Delivery Charges:</span> <span>{{summary.deliveryCharge}}</span></div>
                  {{/if}}
                  <div class="totals-row grand-total"><span>Grand Total:</span> <span>₹{{summary.grandTotal}}</span></div>
                  <div style="font-size: 12px; margin-top: 5px; text-align: right;">Amount in words:<br><strong>{{amountInWords}}</strong></div>
              </div>
              
              <div style="clear: both;"></div>
              
              <div class="footer">
                  <p>This is a computer generated invoice and does not require a signature.</p>
              </div>
            </body>
            </html>
            `;

            const template = handlebars.compile(templateHtml);
            const html = template(data);

            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({ format: 'A4', printBackground: true });

            return pdf;
        } finally {
            await browser.close();
        }
    }

    /**
     * Upload File to Supabase Storage
     */
    static async _uploadToStorage(filename, fileBuffer) {
        try {
            const bucketName = 'invoices';

            // 1. Upload
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filename, fileBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) {
                // If bucket doesn't exist, try creating it?
                // Note: Client creation of buckets requires specific permissions. 
                // Better to log error and fallback.
                throw uploadError;
            }

            // 2. Get Public URL
            const { data } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filename);

            return data.publicUrl;

        } catch (error) {
            log.error('UPLOAD_STORAGE_FAIL', error);
            return null; // Fallback to local
        }
    }


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
