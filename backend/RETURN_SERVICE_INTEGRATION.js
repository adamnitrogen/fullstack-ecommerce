/**
 * RETURN SERVICE - DELIVERY REFUND INTEGRATION SCRIPT
 * 
 * This file contains the code changes for return.service.js
 * Apply these changes to enable policy-aware delivery refunds
 */

// ====================================================================
// SECTION 1: Import DeliveryChargeService at top of file
// Add this with other service imports
// ====================================================================

const { DeliveryChargeService } = require('./delivery-charge.service');


// ====================================================================
// SECTION 2: Update processReturnApproval function
// Find where product refund is calculated (look for PricingCalculator.calculateRefund)
// around line 225-314
//
// AFTER the product refund calculation, ADD this delivery refund logic:
// ====================================================================

// Calculate product refund (existing code stays)
const refundCalc = PricingCalculator.calculateRefund(orderItemsData, returnItems);
const productRefundAmount = refundCalc.summary.totalRefund;

// === NEW CODE STARTS HERE ===

// Calculate delivery refund with policy enforcement
let deliveryRefundAmount = 0;
let deliveryGSTRefundAmount = 0;
let deliveryPolicyDetails = [];

try {
    const deliveryRefund = await DeliveryChargeService.calculateRefundDelivery(
        orderItemsData,
        returnItems
    );

    deliveryRefundAmount = deliveryRefund.refundDeliveryCharge;
    deliveryGSTRefundAmount = deliveryRefund.refundDeliveryGST;
    deliveryPolicyDetails = deliveryRefund.policyDetails;

    logger.info('[Return] Delivery refund calculated:', {
        originalDelivery: deliveryRefund.originalDeliveryCharge,
        originalDeliveryGST: deliveryRefund.originalDeliveryGST,
        remainingDelivery: deliveryRefund.remainingDeliveryCharge,
        refundDelivery: deliveryRefundAmount,
        refundDeliveryGST: deliveryGSTRefundAmount,
        isRefundable: deliveryRefund.isRefundable,
        policiesApplied: deliveryPolicyDetails.length,
        nonRefundableCount: deliveryPolicyDetails.filter(p => p.policy === 'NON_REFUNDABLE').length
    });

    // Log each policy decision for audit trail
    deliveryPolicyDetails.forEach(policy => {
        if (policy.policy === 'NON_REFUNDABLE') {
            logger.info('[Return] NON_REFUNDABLE policy enforced', {
                product_id: policy.product_id,
                variant_id: policy.variant_id,
                delivery_charge: policy.original_delivery,
                delivery_gst: policy.original_gst,
                message: 'Delivery charge will not be refunded'
            });
        }
    });

} catch (error) {
    logger.warn('[Return] Failed to calculate delivery refund, skipping', {
        error: error.message
    });
}

// Calculate total refund amount including delivery
const totalRefundAmount = productRefundAmount + deliveryRefundAmount + deliveryGSTRefundAmount;

logger.info('[Return] Total refund breakdown:', {
    productRefund: productRefundAmount,
    deliveryRefund: deliveryRefundAmount,
    deliveryGSTRefund: deliveryGSTRefundAmount,
    totalRefund: totalRefundAmount,
    returnId: returnId
});

// === NEW CODE ENDS HERE ===


// ====================================================================
// SECTION 3: Update Razorpay refund call
// Find where razorpay.payments.refund is called
// Update to use totalRefundAmount and include delivery details in notes:
// ====================================================================

// Process refund via Razorpay with total amount including delivery
const refund = await razorpay.payments.refund(
    payment.razorpay_payment_id,
    {
        amount: Math.round(totalRefundAmount * 100), // Changed to include delivery
        notes: {
            return_id: returnId,
            product_refund: productRefundAmount,
            delivery_refund: deliveryRefundAmount,
            delivery_gst_refund: deliveryGSTRefundAmount,
            delivery_policies: JSON.stringify(deliveryPolicyDetails.map(p => ({
                product_id: p.product_id,
                policy: p.policy
            })))
        }
    }
);


// ====================================================================
// TESTING SCENARIOS
// ====================================================================
/*
Test Case 1: REFUNDABLE Policy
1. Configure product with delivery_refund_policy = 'REFUNDABLE'
2. Order 20 units (7 packages, ₹861 delivery)
3. Return 14 units
4. Expected: Delivery refund ₹615 + ₹111 GST ✅
5. Check logs for "Delivery will be refunded"

Test Case 2: NON_REFUNDABLE Policy
1. Configure product with delivery_refund_policy = 'NON_REFUNDABLE'
2. Order 20 units (7 packages, ₹861 delivery)
3. Return 14 units
4. Expected: Delivery refund ₹0 ❌
5. Check logs for "NON_REFUNDABLE policy enforced"

Test Case 3: Mixed Policies
1. Product A (REFUNDABLE) + Product B (NON_REFUNDABLE) in cart
2. Order both products
3. Return items from both
4. Expected: Only Product A delivery refunded
5. Check policyDetails in logs show both policies applied

Verification:
- Check Razorpay refund notes include delivery amounts
- Check logs show policy enforcement
- Verify total refund = product + delivery (if refundable)
- Confirm audit trail in database
*/
