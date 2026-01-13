import { CartTotals } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Tag, Truck, Wallet, Sparkles } from "lucide-react";

interface PriceBreakdownProps {
    totals: CartTotals;
}

export function PriceBreakdown({ totals }: PriceBreakdownProps) {
    const totalSavings = totals.discount + totals.couponDiscount;

    return (
        <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-base flex items-center gap-2 font-playfair">
                <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                Payment Details
            </h3>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal (MRP)</span>
                    <span className="font-medium">₹{totals.totalMrp?.toFixed(2) || totals.totalPrice.toFixed(2)}</span>
                </div>

                {totals.discount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            Product Discount
                        </span>
                        <span className="font-medium">-₹{totals.discount.toFixed(2)}</span>
                    </div>
                )}

                {totals.couponDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Coupon ({totals.coupon?.code})
                        </span>
                        <span className="font-medium">-₹{totals.couponDiscount.toFixed(2)}</span>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Truck className="w-3.5 h-3.5" />
                        Delivery Charges
                    </span>
                    {totals.deliveryCharge === 0 ? (
                        <span className="text-emerald-600 font-bold text-[10px] uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">FREE</span>
                    ) : (
                        <span className="font-medium">₹{totals.deliveryCharge.toFixed(2)}</span>
                    )}
                </div>
            </div>

            <Separator className="bg-border/60" />

            <div className="flex justify-between items-end">
                <span className="text-base font-bold text-foreground/80">Total Payable</span>
                <span className="text-xl font-bold font-playfair text-primary">₹{totals.finalAmount.toFixed(2)}</span>
            </div>

            {totalSavings > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 text-[10px] px-3 py-2 rounded-md text-center font-bold border border-emerald-100 dark:border-emerald-800 border-dashed animate-in fade-in slide-in-from-bottom-1">
                    🎉 You're saving ₹{totalSavings.toFixed(2)}!
                </div>
            )}
        </div>
    );
}

