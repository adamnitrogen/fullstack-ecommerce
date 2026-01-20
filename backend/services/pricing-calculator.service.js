/**
 * Pricing Calculator Service
 * Integrates TaxEngine with checkout flow for complete pricing breakdown
 */

const { TaxEngine, TAX_TYPE } = require('./tax-engine.service');
const settingsService = require('./settings.service');
const { validateCoupon, calculateCouponDiscount } = require('./coupon.service');
const logger = require('../utils/logger');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('PricingCalculator');

class PricingCalculator {
    /**
     * Calculate complete checkout totals including taxes
     * @param {Array} cartItems - Cart items with product/variant data
     * @param {Object} shippingAddress - Customer's shipping address
     * @param {string} couponCode - Optional coupon code
     * @param {string} userId - User ID for coupon validation
     * @returns {Object} Complete pricing breakdown
     */
    static async calculateCheckoutTotals(cartItems, shippingAddress, couponCode = null, userId = null) {
        log.operationStart('CALCULATE_CHECKOUT_TOTALS', {
            itemCount: cartItems.length,
            hasCoupon: !!couponCode,
            hasAddress: !!shippingAddress
        });

        const startTime = Date.now();

        try {
            // 1. Calculate MRP totals (before any discounts)
            let totalMrp = 0;
            let totalSellingPrice = 0;

            const normalizedItems = cartItems.map(item => {
                const variant = item.variant || item.product_variants || {};
                const product = item.product || item.products || {};
                const quantity = item.quantity || 1;

                const price = variant.selling_price || product.price || 0;
                const mrp = variant.mrp || product.mrp || price;

                totalMrp += mrp * quantity;
                totalSellingPrice += price * quantity;

                return {
                    ...item,
                    variant,
                    product,
                    quantity,
                    unitPrice: price,
                    unitMrp: mrp
                };
            });

            // 2. Calculate MRP discount (before coupon)
            const mrpDiscount = totalMrp - totalSellingPrice;

            // 3. Validate and calculate coupon discount (applied to pre-tax price)
            let couponDiscount = 0;
            let validatedCoupon = null;

            if (couponCode && userId) {
                const validation = await validateCoupon(couponCode, userId, normalizedItems, totalSellingPrice);
                if (validation.valid) {
                    validatedCoupon = validation.coupon;
                    couponDiscount = calculateCouponDiscount(validatedCoupon, normalizedItems, totalSellingPrice);
                } else {
                    log.warn('COUPON_INVALID', validation.error, { couponCode });
                }
            }

            // 4. Calculate subtotal after coupons (this is what we apply tax to)
            const subtotalAfterCoupons = totalSellingPrice - couponDiscount;

            // 5. Calculate taxes using TaxEngine
            const taxResult = TaxEngine.calculateOrderTax(normalizedItems, shippingAddress);

            // 6. Get delivery settings
            const settings = await settingsService.getDeliverySettings();
            const deliveryCharge = totalSellingPrice >= settings.delivery_threshold ? 0 : settings.delivery_charge;

            // 7. Calculate final amount
            // Note: Tax is calculated on selling price, coupon reduces the amount you pay
            // Final = (taxable + tax) - couponDiscount + delivery
            const finalAmount = taxResult.summary.total_amount - couponDiscount + deliveryCharge;

            const result = {
                // Item details
                items_count: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
                items: taxResult.items.map(item => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    unit_mrp: item.unitMrp,
                    line_total: item.unitPrice * item.quantity,
                    tax_breakdown: item.taxBreakdown
                })),

                // Price breakdown
                total_mrp: Math.round(totalMrp * 100) / 100,
                total_selling_price: Math.round(totalSellingPrice * 100) / 100,
                mrp_discount: Math.round(mrpDiscount * 100) / 100,

                // Coupon
                coupon_code: validatedCoupon?.code || null,
                coupon_discount: Math.round(couponDiscount * 100) / 100,

                // Subtotal (after MRP discount and coupon, before tax)
                subtotal_before_tax: Math.round((totalSellingPrice - couponDiscount) * 100) / 100,

                // Tax breakdown
                tax: {
                    total_taxable_amount: taxResult.summary.total_taxable_amount,
                    cgst: taxResult.summary.total_cgst,
                    sgst: taxResult.summary.total_sgst,
                    igst: taxResult.summary.total_igst,
                    total_tax: taxResult.summary.total_tax,
                    tax_type: taxResult.summary.tax_type,
                    is_inter_state: taxResult.summary.tax_type === TAX_TYPE.INTER_STATE
                },

                // Delivery
                delivery_charge: Math.round(deliveryCharge * 100) / 100,
                free_delivery_threshold: settings.delivery_threshold,
                delivery_settings: {
                    threshold: settings.delivery_threshold,
                    charge: settings.delivery_charge,
                    gst: settings.delivery_gst
                },

                // Final
                final_amount: Math.round(finalAmount * 100) / 100,

                // Metadata for order creation
                _meta: {
                    seller_state_code: taxResult.summary.seller_state_code,
                    buyer_state_code: taxResult.summary.buyer_state_code,
                    calculated_at: new Date().toISOString()
                }
            };

            log.operationSuccess('CALCULATE_CHECKOUT_TOTALS', {
                finalAmount: result.finalAmount,
                taxAmount: result.tax.totalTax,
                taxType: result.tax.taxType
            }, Date.now() - startTime);

            return result;

        } catch (error) {
            log.operationError('CALCULATE_CHECKOUT_TOTALS', error);
            throw error;
        }
    }

    /**
     * Calculate refund amount for returned items
     * @param {Array} orderItems - Original order items with tax snapshots
     * @param {Array} returnItems - Items being returned with quantities
     * @returns {Object} Refund breakdown
     */
    static calculateRefund(orderItems, returnItems) {
        log.operationStart('CALCULATE_REFUND', {
            orderItemCount: orderItems.length,
            returnItemCount: returnItems.length
        });

        let totalRefund = 0;
        let totalTaxRefund = 0;
        let cgstRefund = 0;
        let sgstRefund = 0;
        let igstRefund = 0;
        let taxableRefund = 0;

        const itemBreakdowns = returnItems.map(returnItem => {
            const orderItem = orderItems.find(oi => oi.id === returnItem.orderItemId);
            if (!orderItem) {
                log.warn('REFUND_ITEM_NOT_FOUND', `Order item ${returnItem.orderItemId} not found`);
                return null;
            }

            const returnQuantity = returnItem.quantity;
            const originalQuantity = orderItem.quantity;
            const refundRatio = returnQuantity / originalQuantity;

            // Calculate proportional refund
            const itemTaxableRefund = (orderItem.taxable_amount || orderItem.price_per_unit * originalQuantity) * refundRatio;
            const itemCgstRefund = (orderItem.cgst || 0) * refundRatio;
            const itemSgstRefund = (orderItem.sgst || 0) * refundRatio;
            const itemIgstRefund = (orderItem.igst || 0) * refundRatio;
            const itemTotalRefund = (orderItem.total_amount || orderItem.price_per_unit * originalQuantity) * refundRatio;

            taxableRefund += itemTaxableRefund;
            cgstRefund += itemCgstRefund;
            sgstRefund += itemSgstRefund;
            igstRefund += itemIgstRefund;
            totalRefund += itemTotalRefund;
            totalTaxRefund += (itemCgstRefund + itemSgstRefund + itemIgstRefund);

            return {
                orderItemId: orderItem.id,
                productTitle: orderItem.title || orderItem.variant_snapshot?.product_title,
                returnQuantity,
                originalQuantity,
                taxableRefund: Math.round(itemTaxableRefund * 100) / 100,
                cgstRefund: Math.round(itemCgstRefund * 100) / 100,
                sgstRefund: Math.round(itemSgstRefund * 100) / 100,
                igstRefund: Math.round(itemIgstRefund * 100) / 100,
                totalRefund: Math.round(itemTotalRefund * 100) / 100
            };
        }).filter(Boolean);

        const result = {
            items: itemBreakdowns,
            summary: {
                taxableRefund: Math.round(taxableRefund * 100) / 100,
                cgstRefund: Math.round(cgstRefund * 100) / 100,
                sgstRefund: Math.round(sgstRefund * 100) / 100,
                igstRefund: Math.round(igstRefund * 100) / 100,
                totalTaxRefund: Math.round(totalTaxRefund * 100) / 100,
                totalRefund: Math.round(totalRefund * 100) / 100
            }
        };

        log.operationSuccess('CALCULATE_REFUND', result.summary);
        return result;
    }

    /**
     * Format pricing for Razorpay invoice line items
     * @param {Array} items - Items with tax breakdowns
     * @returns {Array} Razorpay-formatted line items
     */
    static formatForRazorpayInvoice(items) {
        return items.map(item => {
            const variant = item.variant || {};
            const product = item.product || {};
            const tax = item.taxBreakdown || {};

            const lineItem = {
                name: `${product.title || 'Product'} - ${variant.size_label || 'Standard'}`,
                description: variant.description || product.description || '',
                amount: Math.round(tax.taxableAmount * 100), // Amount in paisa
                currency: 'INR',
                quantity: item.quantity || 1
            };

            // Add GST fields only if tax is applicable
            if (tax.gstRate && tax.gstRate > 0) {
                lineItem.hsn_code = tax.hsnCode || undefined;
                lineItem.tax_rate = tax.gstRate;

                // Razorpay expects tax amounts in paisa
                if (tax.taxType === TAX_TYPE.INTER_STATE) {
                    lineItem.igst = Math.round(tax.igst * 100);
                } else {
                    lineItem.cgst = Math.round(tax.cgst * 100);
                    lineItem.sgst = Math.round(tax.sgst * 100);
                }
            }

            return lineItem;
        });
    }
}

module.exports = { PricingCalculator };
