import { useState } from "react";
import { Tag as TagIcon, X, ShieldCheck, Truck, RotateCcw, Loader2, Gift, Sparkles } from "lucide-react";
import { CartTotals, Coupon } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CartSummaryProps {
    totals: CartTotals | null;
    itemsCount: number;
    isLoading: boolean;
    onApplyCoupon: (code: string) => Promise<boolean>;
    onRemoveCoupon: () => Promise<void>;
    onCheckout: () => void;
    availableCoupons?: Coupon[];
    deliverySettings?: { threshold: number; charge: number };
    isCalculating?: boolean;
}


export const CartSummary = ({
    totals,
    itemsCount,
    isLoading,
    onApplyCoupon,
    onRemoveCoupon,
    onCheckout,
    availableCoupons = [],
    deliverySettings = { threshold: 1500, charge: 50 },
    isCalculating = false,
    items = []
}: CartSummaryProps & { items?: any[] }) => {
    const [couponCode, setCouponCode] = useState("");
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

    const handleApplyCoupon = async (codeOverride?: string) => {
        const code = codeOverride || couponCode;
        if (!code.trim()) {
            toast.error("Please enter a coupon code");
            return;
        }

        setIsApplyingCoupon(true);
        try {
            await onApplyCoupon(code);
            setCouponCode("");
        } finally {
            setIsApplyingCoupon(false);
        }
    };

    const effectiveThreshold = totals?.deliverySettings?.threshold ?? deliverySettings.threshold;

    const deliveryProgress = totals
        ? Math.min((totals.totalPrice / effectiveThreshold) * 100, 100)
        : 0;

    const remainingForFreeDelivery = totals
        ? Math.max(effectiveThreshold - totals.totalPrice, 0)
        : 0;

    return (
        <Card className="sticky top-24 shadow-xl border-border/40 bg-card/40 backdrop-blur-md animate-in slide-in-from-right-4 duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

            <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-black tracking-tight font-playfair flex items-center justify-between">
                    Order Summary
                    <div className="bg-primary/10 text-primary text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold">
                        {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Available Offers Section */}
                {availableCoupons.length > 0 && !totals?.coupon && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-700">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/80">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Available Offers
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                            {availableCoupons.map((coupon) => (
                                <button
                                    key={coupon.id}
                                    onClick={() => handleApplyCoupon(coupon.code)}
                                    className="p-3 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl flex-shrink-0 w-48 transition-all hover:scale-[1.02] active:scale-95 text-left group snap-center"
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">
                                            {coupon.code}
                                        </div>
                                        <Gift className="w-3.5 h-3.5 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="text-[11px] font-bold text-foreground mb-0.5 truncate uppercase">
                                        {coupon.discount_percentage}% OFF
                                    </p>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
                                        {coupon.min_purchase_amount ? `Min. ₹${coupon.min_purchase_amount}` : 'No min. purchase'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Price Breakdown */}
                <div className="space-y-4 text-sm relative">
                    <div className={cn(
                        "space-y-3",
                        isCalculating && "opacity-50 blur-[1px] pointer-events-none"
                    )}>
                        <div className="flex justify-between text-muted-foreground font-medium">
                            <span>Items Total (MRP)</span>
                            <span className="text-foreground">₹{(totals?.totalMrp || 0).toFixed(2)}</span>
                        </div>

                        {totals && totals.discount > 0 && (
                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                                <span className="flex items-center gap-1.5">
                                    <TagIcon className="w-3.5 h-3.5" />
                                    Product Discounts
                                </span>
                                <span>-₹{totals.discount.toFixed(2)}</span>
                            </div>
                        )}

                        {/* Delivery & Handling Section */}
                        {((totals?.deliveryCharge || 0) + (totals?.deliveryGST || 0)) > 0 && (
                            <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                                    <Truck className="w-3.5 h-3.5" />
                                    Delivery & Handling
                                </div>

                                {/* Standard Delivery */}
                                {(totals?.globalDeliveryCharge ?? 0) > 0 && (
                                    <div className="flex justify-between items-center group/del">
                                        <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                            Standard Delivery
                                            <span className="text-[9px] opacity-40 font-normal">(Non-Ref)</span>
                                            {(totals?.globalDeliveryGST ?? 0) > 0 && (
                                                <span className="text-[8px] uppercase tracking-wider text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-1 py-0 rounded-sm font-bold">
                                                    Incl. Tax
                                                </span>
                                            )}
                                        </span>
                                        <span className="font-bold text-foreground text-xs">
                                            ₹{((totals?.globalDeliveryCharge ?? 0) + (totals?.globalDeliveryGST ?? 0)).toFixed(2)}
                                        </span>
                                    </div>
                                )}

                                {/* Surcharges IIFE */}
                                {(() => {
                                    let refundableBase = 0;
                                    let refundableGst = 0;
                                    let nonRefundableBase = 0;
                                    let nonRefundableGst = 0;

                                    (items || []).forEach(item => {
                                        const meta = item.delivery_meta || {};
                                        const base = item.delivery_charge || 0;
                                        const gst = item.delivery_gst || 0;

                                        if (meta.source !== 'global') {
                                            if (meta.delivery_refund_policy === 'REFUNDABLE') {
                                                refundableBase += base;
                                                refundableGst += gst;
                                            } else {
                                                nonRefundableBase += base;
                                                nonRefundableGst += gst;
                                            }
                                        }
                                    });

                                    const refundableTotal = refundableBase + refundableGst;
                                    const nonRefundableTotal = nonRefundableBase + nonRefundableGst;

                                    return (
                                        <>
                                            {refundableTotal > 0 && (
                                                <div className="flex justify-between items-center pl-1 group/sur">
                                                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
                                                        Refundable Surcharge
                                                        {refundableGst > 0 && (
                                                            <span className="text-[8px] uppercase tracking-wider text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1 py-0 rounded-sm font-bold">
                                                                Incl. Tax
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="font-bold text-xs text-blue-600/90">
                                                        ₹{refundableTotal.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            {nonRefundableTotal > 0 && (
                                                <div className="flex justify-between items-center pl-1 group/sur">
                                                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400/60" />
                                                        Addt. Processing
                                                        <span className="text-[9px] opacity-40 font-normal">(Non-Ref)</span>
                                                        {nonRefundableGst > 0 && (
                                                            <span className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50/50 border border-orange-100/50 px-1 py-0 rounded-sm font-bold">
                                                                Incl. Tax
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="font-bold text-xs text-orange-600/90">
                                                        ₹{nonRefundableTotal.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Tax Details Section */}
                        {totals && (totals.tax?.totalTax ?? 0) > 0 && (
                            <div className="pt-2 border-t border-dashed border-border/40">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] text-muted-foreground/50 italic leading-tight font-medium">
                                        Total Tax (Included)
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/50 italic font-medium">
                                        ₹{totals.tax.totalTax.toFixed(2)}
                                    </span>
                                </div>

                                <details className="group mt-1 px-1">
                                    <summary className="text-[9px] text-primary cursor-pointer hover:underline mb-1 list-none flex items-center gap-1 font-medium opacity-80 hover:opacity-100">
                                        <span>View Tax Breakdown</span>
                                    </summary>
                                    <div className="bg-muted/30 rounded p-2 space-y-1.5 mt-1 max-h-[120px] overflow-y-auto custom-scrollbar">
                                        {/* Product Tax */}
                                        {(items || []).map((item, idx) => {
                                            const taxRate = item.variant?.gst_rate ?? item.product?.default_gst_rate ?? 0;
                                            if (taxRate <= 0) return null;
                                            const sellingPrice = item.variant?.selling_price ?? item.product?.price ?? 0;
                                            const itemTotal = sellingPrice * (item.quantity || 1);
                                            const itemTax = itemTotal - (itemTotal / (1 + (taxRate / 100)));

                                            return (
                                                <div key={`tax-${idx}`} className="flex flex-col text-[8px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-1 last:pb-0">
                                                    <div className="flex justify-between font-medium text-foreground/70">
                                                        <span className="truncate max-w-[120px]">{item.product?.title}</span>
                                                        <span>{taxRate}% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 opacity-70">
                                                        <span>Tax Amount</span>
                                                        <span>₹{itemTax.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Delivery Tax */}
                                        {(() => {
                                            const delTaxLines = [];
                                            if ((totals?.globalDeliveryGST ?? 0) > 0) {
                                                delTaxLines.push({ label: "Standard Delivery GST", amount: totals.globalDeliveryGST || 0 });
                                            }
                                            let surchargeGST = 0;
                                            (items || []).forEach(it => { if (it.delivery_meta?.source !== 'global') surchargeGST += (it.delivery_gst || 0); });
                                            if (surchargeGST > 0) {
                                                delTaxLines.push({ label: "Sur-Charge GST", amount: surchargeGST });
                                            }

                                            return delTaxLines.map((line, lidx) => (
                                                <div key={`del-tax-${lidx}`} className="flex flex-col text-[8px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-1 last:pb-0">
                                                    <div className="flex justify-between font-medium text-foreground/70">
                                                        <span>{line.label}</span>
                                                        <span>18% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 opacity-70">
                                                        <span>Tax Amount</span>
                                                        <span>₹{line.amount.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>

                    {/* Loader */}
                    {isCalculating && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/20 backdrop-blur-[1px]">
                            <span className="flex items-center gap-2 px-3 py-1 bg-background/80 rounded-full border shadow-sm text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                Updating...
                            </span>
                        </div>
                    )}
                </div>

                {/* Delivery Progress */}
                {totals && (totals.globalDeliveryCharge || 0) > 0 && (
                    <div className="space-y-2">
                        <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden border border-border/10">
                            <div
                                className="h-full bg-primary transition-all duration-700 ease-out"
                                style={{ width: `${deliveryProgress}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground text-center italic">
                            Add <span className="font-bold text-foreground">₹{remainingForFreeDelivery.toFixed(2)}</span> more for <span className="text-emerald-600 font-bold uppercase tracking-tighter">Free Delivery</span>
                        </p>
                    </div>
                )}

                {totals?.coupon && totals.couponDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-black pt-1 border-t border-dashed border-emerald-100/50">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Coupon ({totals.coupon.code})
                        </span>
                        <span>-₹{totals.couponDiscount.toFixed(2)}</span>
                    </div>
                )}

                <Separator className="opacity-50" />

                {/* Promotional Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                        <TagIcon className="w-3.5 h-3.5" />
                        Apply Promotion
                    </div>

                    {totals?.coupon ? (
                        <div className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl animate-in zoom-in-95">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                    <Gift className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Applied</div>
                                    <div className="text-sm font-black text-emerald-700 tracking-tight">{totals.coupon.code}</div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onRemoveCoupon}
                                className="h-8 w-8 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Input
                                placeholder="PROMO CODE"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                className="uppercase font-bold h-10 rounded-xl"
                                onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                            />
                            <Button
                                onClick={() => handleApplyCoupon()}
                                disabled={!couponCode || isLoading || isApplyingCoupon}
                                className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px]"
                            >
                                {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                            </Button>
                        </div>
                    )}
                </div>

                <Separator className="opacity-50" />

                {/* Final Total */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Pay</span>
                        <div className="text-right">
                            <span className="text-3xl font-black text-primary block leading-none tracking-tighter">
                                ₹{totals?.finalAmount?.toFixed(2) || '0.00'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                                Including GST & Fees
                            </span>
                        </div>
                    </div>

                    {totals && (totals.discount + totals.couponDiscount) > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] p-2.5 rounded-xl text-center font-bold">
                            Congrats! You are saving ₹{(totals.discount + totals.couponDiscount).toFixed(2)}
                        </div>
                    )}

                    <Button
                        size="lg"
                        className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-xl rounded-2xl"
                        onClick={onCheckout}
                        disabled={isLoading || itemsCount === 0}
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Checkout Securely"}
                    </Button>
                </div>

                <Separator className="opacity-30" />

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1 opacity-60">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">Secure</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-60">
                        <Truck className="w-4 h-4 text-primary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">Fast</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-60">
                        <RotateCcw className="w-4 h-4 text-primary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">Returns</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
