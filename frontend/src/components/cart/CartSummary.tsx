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
                <div className="space-y-3 text-sm">
                    <div className={cn(
                        "space-y-4 relative transition-all duration-300",
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

                        <div className="flex flex-col gap-2 pt-1">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center group/delivery">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
                                            <Truck className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-muted-foreground font-medium">Standard Delivery</span>
                                            {(totals?.globalDeliveryGST ?? 0) > 0 && (
                                                <span className="text-[8px] uppercase tracking-wider text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-1 py-0 rounded-sm font-bold">
                                                    Incl. Tax
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {totals?.globalDeliveryCharge === 0 ? (
                                            <span className="text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Free</span>
                                        ) : (
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-foreground">
                                                    ₹{((totals?.globalDeliveryCharge ?? 0) + (totals?.globalDeliveryGST ?? 0)).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {totals && (totals.globalDeliveryGST ?? 0) > 0 && (
                                    <div className="flex justify-between items-center pl-8">
                                        <span className="text-[10px] text-muted-foreground/50 italic leading-tight">
                                            Includes ₹{(totals.globalDeliveryGST ?? 0).toFixed(2)} GST
                                        </span>
                                    </div>
                                )}
                            </div>

                            {totals && (totals.productDeliveryCharges || 0) > 0 && (
                                <div className="flex flex-col gap-0.5 mt-1 border-t border-dashed border-orange-100/50 pt-2 animate-in slide-in-from-left-2 duration-500">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100/50">
                                                <Truck className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground font-medium">Item Surcharges</span>
                                                {(totals.productDeliveryGST ?? 0) > 0 && (
                                                    <span className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50/50 border border-orange-100/50 px-1 py-0 rounded-sm font-bold">
                                                        Incl. Tax
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="font-bold text-orange-600">₹{((totals.productDeliveryCharges || 0) + (totals.productDeliveryGST || 0)).toFixed(2)}</span>
                                    </div>
                                    {(totals.productDeliveryGST ?? 0) > 0 && (
                                        <div className="flex justify-between items-center pl-8">
                                            <span className="text-[10px] text-muted-foreground/50 italic leading-tight">
                                                Includes ₹{(totals.productDeliveryGST ?? 0).toFixed(2)} Surcharge GST
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tax Breakdown */}
                            {totals && totals.tax && totals.tax.totalTax > 0 && (
                                <div className="flex flex-col gap-0.5 mt-1 border-t border-dashed border-border/50 pt-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] text-muted-foreground/50 italic leading-tight font-medium">
                                            Total Tax (Included)
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/50 italic font-medium">₹{totals.tax.totalTax.toFixed(2)}</span>
                                    </div>

                                    {/* Product-wise Tax Breakdown (Collapsible) */}
                                    {items && items.length > 0 && (
                                        <div className="mt-1 px-1">
                                            <details className="group">
                                                <summary className="text-[9px] text-primary cursor-pointer hover:underline mb-1 list-none flex items-center gap-1 font-medium opacity-80 hover:opacity-100">
                                                    <span>View Product Tax Breakdown</span>
                                                </summary>
                                                <div className="bg-muted/30 rounded p-2 space-y-1.5 mt-1 max-h-[120px] overflow-y-auto custom-scrollbar">
                                                    {items.map((item, idx) => {
                                                        const qty = item.quantity || 1;
                                                        const taxRate = item.variant?.gst_rate ?? item.product?.default_gst_rate ?? 0;
                                                        const title = item.product?.title || "Product";

                                                        // Estimation logic
                                                        const sellingPrice = item.variant?.selling_price ?? item.product?.price ?? 0;
                                                        const itemTotal = sellingPrice * qty;
                                                        const itemTax = itemTotal - (itemTotal / (1 + (taxRate / 100)));

                                                        if (taxRate <= 0) return null;

                                                        return (
                                                            <div key={idx} className="flex flex-col text-[8px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-1 last:pb-0">
                                                                <div className="flex justify-between font-medium text-foreground/70">
                                                                    <span className="truncate max-w-[120px]" title={title}>{title}</span>
                                                                    <span>{taxRate}% GST</span>
                                                                </div>
                                                                <div className="flex justify-between pl-1 opacity-70">
                                                                    <span>Tax Amount</span>
                                                                    <span>₹{itemTax.toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {/* Delivery Tax Line Item */}
                                                    {(totals.globalDeliveryCharge ?? 0) > 0 && (totals.globalDeliveryGST ?? 0) > 0 && (
                                                        <div className="flex flex-col text-[8px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-1 last:pb-0">
                                                            <div className="flex justify-between font-medium text-foreground/70">
                                                                <span>Delivery Charges</span>
                                                                <span>18% GST</span>
                                                            </div>
                                                            <div className="flex justify-between pl-1 opacity-70">
                                                                <span>Tax Amount</span>
                                                                <span>₹{(totals.globalDeliveryGST || 0).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </details>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Relative Loader for Calculation */}
                        {isCalculating && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <span className="flex items-center gap-2 px-3 py-1 bg-background/80 backdrop-blur-sm rounded-full border shadow-sm text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                    Recalculating...
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Delivery Progress Bar for Free Shipping */}
                    {totals && (totals.globalDeliveryCharge || 0) > 0 && (
                        <div className="mt-2 space-y-2 pb-1">
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
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-black animate-in zoom-in-95 leading-tight pt-1">
                            <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                Coupon ({totals.coupon.code})
                            </span>
                            <span>-₹{(totals.couponDiscount || 0).toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <Separator className="opacity-50" />

                {/* Coupon Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                        <TagIcon className="w-3.5 h-3.5" />
                        Apply Promotion
                    </div>

                    {totals?.coupon ? (
                        <div className="flex items-center justify-between p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl animate-in zoom-in-95 shadow-inner">
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
                                className="h-8 w-8 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                                disabled={isLoading}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2 relative">
                            <Input
                                placeholder="PROMO CODE"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                className="uppercase placeholder:normal-case font-bold h-11 rounded-xl border-border/50 bg-background/50 focus:ring-primary/20"
                                disabled={isLoading || isApplyingCoupon}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleApplyCoupon();
                                }}
                            />
                            <Button
                                onClick={() => handleApplyCoupon()}
                                disabled={!couponCode || isLoading || isApplyingCoupon}
                                className="shrink-0 h-11 px-5 rounded-xl font-black uppercase tracking-widest text-[10px]"
                            >
                                {isApplyingCoupon ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Redeem"
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                <Separator className="opacity-50" />

                {/* Total & Checkout */}
                <div className={cn(
                    "space-y-5 transition-all duration-300",
                    isCalculating && "opacity-50 blur-[1px] pointer-events-none"
                )}>
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
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] p-3 rounded-xl text-center font-bold animate-pulse">
                            Congrats! You are saving ₹{(totals.discount + totals.couponDiscount).toFixed(2)}
                        </div>
                    )}
                </div>

                <Button
                    size="lg"
                    className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 rounded-2xl"
                    onClick={onCheckout}
                    disabled={isLoading || itemsCount === 0}
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                    Checkout Securely
                </Button>

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="flex flex-col items-center justify-center text-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground leading-tight uppercase tracking-tighter">Safe & Secure</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                        <Truck className="w-5 h-5 text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground leading-tight uppercase tracking-tighter">Fast Shipping</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                        <RotateCcw className="w-5 h-5 text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground leading-tight uppercase tracking-tighter">Easy Return</span>
                    </div>
                </div>
            </CardContent >
        </Card >
    );
};
