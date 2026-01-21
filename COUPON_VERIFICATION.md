# Coupon Discount Verification Report

## Executive Summary
✅ **CONFIRMED**: Coupons are handled correctly as **pure discounts** throughout the system. They are **NEVER** included in refunds, order details, or Razorpay invoices as separate line items.

---

## 1. Razorpay Invoice Handling

### Location: `checkout.service.js:201-333` (createRazorpayInvoice)

**How coupons are applied:**
```javascript
// Line 280-283: Coupon is applied as discount_amount (NOT a line item)
const discountVal = (totals?.couponDiscount || 0);
if (discountVal > 0) {
    payload.discount_amount = Math.round(discountVal * 100);
}
```

**What this means:**
- ✅ Coupon discount uses Razorpay's `discount_amount` field
- ✅ This is a **native discount mechanism**, not a line item
- ✅ The invoice shows: `Subtotal - Discount = Total`
- ✅ Customer sees the discount clearly but it's not a refundable item

**Line items explicitly exclude coupons:**
```javascript
// Line 211-213: Coupons are filtered OUT from line items
const productItems = lineItems.filter(item =>
    !['Standard Delivery (Non-Ref)', 'Refundable Surcharge', 
      'Addt. Processing (Non-Ref)', 'Coupon Discount'].includes(item.name)
);
```

---

## 2. Refund Calculation

### Location: `refund.service.js:21-94` (calculateRefundAmount)

**Analysis:**
```javascript
// The ENTIRE function has ZERO mentions of "coupon"
// Refunds only exclude delivery charges based on policy
```

**Refund formula:**
- **Technical Refund**: `refund = total_amount` (100% refund)
- **Business Refund**: `refund = total_amount - non_refundable_delivery`

**What's excluded from refunds:**
- ❌ Non-refundable delivery charges
- ❌ Non-refundable delivery GST

**What's NOT excluded:**
- ✅ Coupon discounts (they're already subtracted from total_amount)

**Why this is correct:**
The `total_amount` stored in the order is **AFTER** coupon discount is applied:
```javascript
// checkout.service.js:478
total_amount: totals.finalAmount,  // This is AFTER coupon discount
coupon_discount: totals.couponDiscount || 0,  // Stored for reference only
```

So when refunding `total_amount`, the customer gets back what they **actually paid**, not the original price.

---

## 3. Order Creation Flow

### Location: `checkout.service.js:371-752` (createOrder)

**Order data structure:**
```javascript
const orderData = {
    total_amount: totals.finalAmount,      // ← Already discounted
    subtotal: totals.totalPrice,           // ← Original price
    coupon_code: totals.coupon?.code,      // ← For reference
    coupon_discount: totals.couponDiscount // ← For display only
};
```

**Key insight:**
- `total_amount` = What customer pays (after discount)
- `coupon_discount` = Informational field for order history
- Refunds use `total_amount`, so customer gets back what they paid

---

## 4. Buy Now Flow

### Location: `checkout.service.js:1315-1450` (processBuyNowOrder)

**Verification:**
- ✅ Buy Now calls `createOrder()` with virtual cart
- ✅ Uses same `createRazorpayInvoice()` function
- ✅ Same coupon handling applies

---

## 5. Email Templates

### Location: `email/templates/order.template.js:125-128`

**How coupons appear in emails:**
```javascript
${(order.coupon_discount || 0) > 0 ? `
    <td>Coupon Discount (${order.coupon_code})</td>
    <td style="color: green;">-₹${order.coupon_discount.toFixed(2)}</td>
` : ''}
```

**Result:**
- ✅ Displayed as a **negative line** (discount)
- ✅ Clearly shows it reduces the total
- ✅ Not a refundable item

---

## 6. Internal Invoice Service

### Location: `invoice-orchestrator.service.js:186-188`

**Coupon handling:**
```javascript
const couponDiscount = order.coupon_discount || 0;
if (couponDiscount > 0) {
    data.discount_amount = Math.round(couponDiscount * 100);
}
```

**Confirmation:**
- ✅ Uses `discount_amount` field (not line item)
- ✅ Consistent with Razorpay invoice approach

---

## Summary Table

| Aspect | Coupon Treatment | Refundable? |
|--------|------------------|-------------|
| **Razorpay Invoice** | `discount_amount` field | ❌ No (it's a discount) |
| **Order total_amount** | Already subtracted | N/A (customer paid less) |
| **Refund calculation** | Not mentioned in code | ❌ No (refund = what was paid) |
| **Order details** | Stored for reference | ❌ No (display only) |
| **Email template** | Shown as discount line | ❌ No (visual only) |

---

## Real-World Example

**Scenario:**
- Product price: ₹1000
- Coupon: 20% off (₹200 discount)
- Delivery: ₹100 (non-refundable)
- **Total paid by customer: ₹900**

**What's stored:**
```javascript
{
  subtotal: 1000,
  coupon_discount: 200,
  delivery_charge: 100,
  total_amount: 900  // ← This is what customer paid
}
```

**If customer requests refund:**
```javascript
refundAmount = total_amount - non_refundable_delivery
             = 900 - 100
             = ₹800
```

**Customer gets:** ₹800 (correct - they paid ₹900, keep ₹100 delivery)

**If coupon was refundable (WRONG scenario):**
```javascript
refundAmount = 1000 - 100 = ₹900  // ← Customer would profit!
```

---

## Conclusion

✅ **Coupons are handled correctly as pure discounts**
✅ **Never included in refund calculations**
✅ **Properly displayed in Razorpay invoices using discount_amount**
✅ **Stored in order details for reference/audit only**
✅ **Customer refunds are based on actual amount paid (after discount)**

**No changes needed** - the implementation is correct and secure.
