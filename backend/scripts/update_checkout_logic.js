const fs = require('fs');
const path = require('path');

const filePath = '/Users/ayush/Developer/Personal-Projects/antigravity-project/ecommerce-fullstack/backend/services/checkout.service.js';
const newContent = `        // Apply Coupon Discount using PRECISE breakdown from Pricing Engine calculator
        // This ensures Product vs Variant vs Cart coupons are applied exactly as per business logic
        const discountVal = (totals?.couponDiscount || 0);
        const itemBreakdown = totals?.itemBreakdown || [];

        if (discountVal > 0 && cleanLineItems.length > 0) {
            
            // Strategy: Use precise discount from itemBreakdown if available (Preferred)
            // Fallback: Proportional distribution (Legacy/Safety)
            
            let preciseDiscountApplied = 0;
            let appliedPreciseLogic = false;

            if (itemBreakdown.length > 0) {
                cleanLineItems.forEach(item => {
                    // Find matching item in breakdown using ID
                    // We check variantId first (most specific), then productId
                    const breakdownItem = itemBreakdown.find(bi => {
                        if (item.variantId && bi.variant_id) {
                            return bi.variant_id === item.variantId;
                        }
                        return bi.product_id === item.productId && !bi.variant_id; // Match product-only items
                    });

                    if (breakdownItem && breakdownItem.coupon_discount > 0) {
                        const originalAmount = item.amount; // In Paise
                        const discountInPaise = Math.round(breakdownItem.coupon_discount * 100);

                        // Ensure we don't discount more than the item price
                        const finalDiscount = Math.min(discountInPaise, originalAmount);
                        
                        item.amount = originalAmount - finalDiscount;
                        preciseDiscountApplied += finalDiscount;
                        appliedPreciseLogic = true;
                    }
                });
            }

            if (appliedPreciseLogic) {
                logger.info({
                    receipt,
                    discountVal,
                    preciseDiscountApplied: preciseDiscountApplied / 100
                }, '[Checkout] Applied PRECISE coupon discounts from PricingEngine');
            } else {
                // FALLBACK: Proportional Logic (for old carts or missing breakdown)
                // Calculate total before discount (PRODUCTS ONLY)
                const totalBeforeDiscount = cleanLineItems.reduce((sum, item) => sum + item.amount, 0); // Paise
                const discountInPaise = Math.round(discountVal * 100);
                
                // Safety: Constraint discount to product total
                const effectiveDiscountInPaise = Math.min(discountInPaise, totalBeforeDiscount);
                const targetTotal = totalBeforeDiscount - effectiveDiscountInPaise;
                const discountFactor = effectiveDiscountInPaise / totalBeforeDiscount;

                let runningTotal = 0;

                cleanLineItems.forEach((item, index) => {
                    const originalAmount = item.amount;
                    if (index === cleanLineItems.length - 1) {
                        const newAmount = Math.max(0, targetTotal - runningTotal);
                        item.amount = newAmount;
                    } else {
                        const itemDiscount = Math.round(originalAmount * discountFactor);
                        item.amount = originalAmount - itemDiscount;
                        runningTotal += item.amount;
                    }
                });
                
                logger.info({
                    receipt,
                    totalBeforeDiscount,
                    effectiveDiscountInPaise
                }, '[Checkout] Applied PROPORTIONAL (Fallback) coupon discounts');
            }
        }

        // Sanitize Line Items (Remove internal IDs before sending to Razorpay)
        cleanLineItems.forEach(item => {
            delete item.productId;
            delete item.variantId;
        });`;

try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/);

    console.log('Total lines:', lines.length);

    // Validate target lines to ensure we are replacing the correct block
    // Line 304 (index 303) starts with: "        // Apply Coupon Discount by proportionally reducing line item amounts"
    if (!lines[303].includes('Apply Coupon Discount by proportionally reducing line item amounts')) {
        console.error('Validation Failed: Line 304 (index 303) does not match expected start.');
        console.error('Actual:', lines[303]);
        // Debug nearby lines
        console.log('Line 302:', lines[301]);
        console.log('Line 303:', lines[302]);
        console.log('Line 304:', lines[303]);
        console.log('Line 305:', lines[304]);
        process.exit(1);
    }

    // Line 356 (index 355) is "        }"
    if (lines[355].trim() !== '}') {
        console.error('Validation Failed: Line 356 (index 355) is not closing brace.');
        console.error('Actual:', lines[355]);
        process.exit(1);
    }

    // Replace lines 304-356 (Index 303 to 355 inclusive = 53 lines)
    const newLines = newContent.split(/\r?\n/);

    lines.splice(303, 53, ...newLines);

    fs.writeFileSync(filePath, lines.join('\n')); // Use \n for writing
    console.log('Successfully replaced lines 304-356 in checkout.service.js');

} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
