import { CartTotals } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Tag, Truck, Wallet, Sparkles } from "lucide-react";

interface PriceBreakdownProps {
    totals: CartTotals;
}

export function PriceBreakdown({ totals, items = [] }: PriceBreakdownProps & { items?: any[] }) {
    const totalSavings = (totals.discount || 0) + (totals.couponDiscount || 0);

    return (
        <div className="space-y-3 pt-2">
            <h3 className="font-semibold text-base flex items-center gap-2 font-playfair">
                <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                Payment Details
            </h3>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Subtotal (MRP)</span>
                    <span className="font-medium">₹{totals.totalMrp?.toFixed(2) || totals.totalPrice?.toFixed(2) || "0.00"}</span>
                </div>

                {totals.discount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            Product Discount
                        </span>
                        <span className="font-medium">-₹{(totals.discount || 0).toFixed(2)}</span>
                    </div>
                )}

                {totals.couponDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            Coupon ({totals.coupon?.code})
                        </span>
                        <span className="font-medium">-₹{(totals.couponDiscount || 0).toFixed(2)}</span>
                    </div>
                )}

                {/* Standard Delivery Charge (Inclusive) */}
                {(totals.globalDeliveryCharge ?? 0) > 0 && (
                    <div className="flex flex-col mb-1.5 group/del">
                        <div className="flex justify-between items-center transition-colors">
                            <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                                Standard Delivery
                                {(totals.globalDeliveryGST ?? 0) > 0 && (
                                    <span className="text-[8px] uppercase tracking-wider text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-1 py-0 rounded-sm font-bold">
                                        Incl. Tax
                                    </span>
                                )}
                            </span>
                            <span className="font-bold text-xs">
                                ₹{((totals.globalDeliveryCharge ?? 0) + (totals.globalDeliveryGST ?? 0)).toFixed(2)}
                            </span>
                        </div>
                        {/* Breakdown of Standard GST */}
                        {(totals.globalDeliveryGST ?? 0) > 0 && (
                            <div className="flex justify-between items-center pl-6 mt-0.5">
                                <span className="text-[10px] text-muted-foreground/50 italic leading-tight">
                                    Includes ₹{(totals.globalDeliveryGST ?? 0).toFixed(2)} Standard GST
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Item Surcharges (Inclusive) */}
                {(totals.productDeliveryCharges ?? 0) > 0 && (
                    <div className="flex flex-col mb-1.5 pt-1.5 border-t border-dashed border-border/40 group/sur">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                                <div className="w-3.5 h-3.5 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                </div>
                                Item Surcharges
                                {(totals.productDeliveryGST ?? 0) > 0 && (
                                    <span className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50/50 border border-orange-100/50 px-1 py-0 rounded-sm font-bold">
                                        Incl. Tax
                                    </span>
                                )}
                            </span>
                            <span className="font-bold text-xs text-orange-600/90">
                                ₹{((totals.productDeliveryCharges ?? 0) + (totals.productDeliveryGST ?? 0)).toFixed(2)}
                            </span>
                        </div>
                        {/* Breakdown of Surcharge GST */}
                        {(totals.productDeliveryGST ?? 0) > 0 && (
                            <div className="flex justify-between items-center pl-6 mt-0.5">
                                <span className="text-[10px] text-muted-foreground/50 italic leading-tight">
                                    Includes ₹{(totals.productDeliveryGST ?? 0).toFixed(2)} Surcharge GST
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Tax Transparency Note */}
                {totals.tax && totals.tax.totalTax > 0 && (
                    <div className="pt-2 border-t border-dashed border-border/40 space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground/50 italic px-1">
                            <span>Total Tax (Included)</span>
                            <span>₹{(totals.tax?.totalTax || 0).toFixed(2)}</span>
                        </div>
                        {totals.tax.isInterState ? (
                            <div className="flex justify-between items-center text-[9px] text-muted-foreground/40 pl-4">
                                <span>↳ IGST</span>
                                <span>₹{(totals.tax?.igst || 0).toFixed(2)}</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-0.5 pl-4">
                                <div className="flex justify-between items-center text-[9px] text-muted-foreground/40">
                                    <span>↳ CGST</span>
                                    <span>₹{(totals.tax?.cgst || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-muted-foreground/40">
                                    <span>↳ SGST</span>
                                    <span>₹{(totals.tax?.sgst || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* Product-wise Tax Breakdown (Collapsible/Inline) */}
                        {items && items.length > 0 && (
                            <div className="mt-2 pt-1">
                                <details className="group">
                                    <summary className="text-[10px] text-primary cursor-pointer hover:underline mb-1 list-none flex items-center gap-1 font-medium">
                                        <span>Show Product Tax Details</span>
                                    </summary>
                                    <div className="bg-muted/30 rounded p-2 space-y-2 mt-1 max-h-[150px] overflow-y-auto">
                                        {items.map((item, idx) => {
                                            const qty = item.quantity || 1;
                                            const taxRate = item.variant?.gst_rate ?? item.product?.default_gst_rate ?? item.gst_rate ?? 0;
                                            const title = item.product?.title || item.title || "Item";

                                            // Estimation if exact tax values not in item
                                            const sellingPrice = item.variant?.selling_price ?? item.product?.price ?? item.price ?? 0;
                                            const itemTotal = sellingPrice * qty;
                                            // Back-calculate tax if price includes tax (assuming it does for this UI context usually)
                                            // The backend TaxEngine handles this precisely, but here we estimate for display
                                            // Tax = Price - (Price / (1 + Rate/100))
                                            const itemTax = itemTotal - (itemTotal / (1 + (taxRate / 100)));

                                            if (taxRate <= 0) return null;

                                            return (
                                                <div key={idx} className="flex flex-col text-[9px] text-muted-foreground border-b border-dashed border-border/50 last:border-0 pb-1 last:pb-0">
                                                    <div className="flex justify-between font-medium text-foreground/80">
                                                        <span className="truncate max-w-[150px]">{title}</span>
                                                        <span>{taxRate}% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1">
                                                        <span>Tax Amount</span>
                                                        <span>₹{itemTax.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Delivery Tax Line Item */}
                                        {(totals.globalDeliveryCharge ?? 0) > 0 && (totals.globalDeliveryGST ?? 0) > 0 && (
                                            <div className="flex flex-col text-[9px] text-muted-foreground border-b border-dashed border-border/50 last:border-0 pb-1 last:pb-0">
                                                <div className="flex justify-between font-medium text-foreground/80">
                                                    <span>Delivery Charges</span>
                                                    <span>18% GST</span>
                                                </div>
                                                <div className="flex justify-between pl-1">
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

            <Separator className="bg-border/60" />

            <div className="flex justify-between items-end">
                <span className="text-base font-bold text-foreground/80">Total Payable</span>
                <span className="text-xl font-bold font-playfair text-primary">₹{(totals.finalAmount || 0).toFixed(2)}</span>
            </div>

            {totalSavings > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 text-[10px] px-3 py-2 rounded-md text-center font-bold border border-emerald-100 dark:border-emerald-800 border-dashed animate-in fade-in slide-in-from-bottom-1">
                    🎉 You're saving ₹{totalSavings.toFixed(2)}!
                </div>
            )}
        </div>
    );
}

