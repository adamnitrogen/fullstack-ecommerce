import { CartTotals } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Tag } from "lucide-react";

interface PriceBreakdownProps {
    totals: CartTotals;
}

export function PriceBreakdown({ totals }: PriceBreakdownProps) {
    return (
        <div className="space-y-3">
            <h3 className="font-semibold text-lg">Price Details</h3>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal (MRP)</span>
                    <span>₹{totals.totalMrp?.toFixed(2) || totals.totalPrice.toFixed(2)}</span>
                </div>

                {totals.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                        <span>Product Discount</span>
                        <span>-₹{totals.discount.toFixed(2)}</span>
                    </div>
                )}

                {totals.couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            Coupon ({totals.coupon?.code})
                        </span>
                        <span>-₹{totals.couponDiscount.toFixed(2)}</span>
                    </div>
                )}

                <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Charges</span>
                    {totals.deliveryCharge === 0 ? (
                        <span className="text-green-600">FREE</span>
                    ) : (
                        <span>₹{totals.deliveryCharge.toFixed(2)}</span>
                    )}
                </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center font-bold text-lg">
                <span>Total Amount</span>
                <span>₹{totals.finalAmount.toFixed(2)}</span>
            </div>

            {totals.discount + totals.couponDiscount > 0 && (
                <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-md text-center font-medium border border-green-100">
                    You will save ₹{(totals.discount + totals.couponDiscount).toFixed(2)} on this order
                </div>
            )}
        </div>
    );
}
