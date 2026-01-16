/**
 * Refund Calculator Service
 * Handles tax-proportional refund calculations for partial and full returns
 */

class RefundCalculator {
    /**
     * Calculate refund breakdown for a single item
     * @param {Object} orderItem - The original order item with tax snapshot
     * @param {number} returnQuantity - Quantity being returned
     * @returns {Object} Refund breakdown (taxable, cgst, sgst, igst, total)
     */
    static calculateItemRefund(orderItem, returnQuantity) {
        if (!orderItem || returnQuantity <= 0) {
            return {
                taxableRefund: 0,
                cgstRefund: 0,
                sgstRefund: 0,
                igstRefund: 0,
                totalRefund: 0
            };
        }

        const quantity = orderItem.quantity;
        // Ratio of return quantity to original quantity
        // Use precision to avoid floating point drift for simple divisions
        const refundRatio = returnQuantity / quantity;

        // Helper to proportionally scale and round to 2 decimals
        const proportional = (amount) => {
            return Number((amount * refundRatio).toFixed(2));
        };

        const taxableRefund = proportional(orderItem.taxable_amount);
        const cgstRefund = proportional(orderItem.cgst);
        const sgstRefund = proportional(orderItem.sgst);
        const igstRefund = proportional(orderItem.igst);

        // Calculate total refund carefully to match sum of components or proportional total
        // Summing components ensures accounting consistency
        // But verifying against proportional total_amount check is also good
        const totalRefund = Number((taxableRefund + cgstRefund + sgstRefund + igstRefund).toFixed(2));

        return {
            taxableRefund,
            cgstRefund,
            sgstRefund,
            igstRefund,
            totalRefund
        };
    }

    /**
     * Calculate total refund for a list of return items
     * @param {Array} orderItems - Full list of order items
     * @param {Array} returnItems - List of items to return [{ orderItemId, quantity }]
     */
    static calculateReturnTotal(orderItems, returnItems) {
        let summary = {
            totalTaxableRefund: 0,
            totalCgstRefund: 0,
            totalSgstRefund: 0,
            totalIgstRefund: 0,
            totalRefund: 0
        };

        const itemBreakdowns = [];

        for (const returnItem of returnItems) {
            const originalItem = orderItems.find(i => i.id === returnItem.orderItemId);
            if (!originalItem) continue;

            const breakdown = this.calculateItemRefund(originalItem, returnItem.quantity);

            summary.totalTaxableRefund += breakdown.taxableRefund;
            summary.totalCgstRefund += breakdown.cgstRefund;
            summary.totalSgstRefund += breakdown.sgstRefund;
            summary.totalIgstRefund += breakdown.igstRefund;
            summary.totalRefund += breakdown.totalRefund;

            itemBreakdowns.push({
                orderItemId: originalItem.id,
                quantity: returnItem.quantity,
                ...breakdown
            });
        }

        // Round final totals to 2 decimals
        summary.totalTaxableRefund = Number(summary.totalTaxableRefund.toFixed(2));
        summary.totalCgstRefund = Number(summary.totalCgstRefund.toFixed(2));
        summary.totalSgstRefund = Number(summary.totalSgstRefund.toFixed(2));
        summary.totalIgstRefund = Number(summary.totalIgstRefund.toFixed(2));
        summary.totalRefund = Number(summary.totalRefund.toFixed(2));

        return {
            summary,
            items: itemBreakdowns
        };
    }
}

module.exports = { RefundCalculator };
