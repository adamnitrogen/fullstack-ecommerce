import { CartTotals } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Tag, Truck, Wallet, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PriceBreakdownProps {
    totals: CartTotals;
}

export function PriceBreakdown({ totals, items = [] }: PriceBreakdownProps & { items?: any[] }) {
    const { t } = useTranslation();
    const totalSavings = (totals.discount || 0) + (totals.couponDiscount || 0);

    return (
        <div className="space-y-4 pt-2">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground/60 mb-1">
                <Wallet className="w-3.5 h-3.5" />
                {t("profile.paymentDetails")}
            </h3>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("profile.subtotalMRP")}</span>
                    <span className="font-medium">₹{totals.totalMrp?.toFixed(2) || totals.totalPrice?.toFixed(2) || "0.00"}</span>
                </div>

                {totals.discount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            {t("profile.productDiscount")}
                        </span>
                        <span className="font-medium">-₹{(totals.discount || 0).toFixed(2)}</span>
                    </div>
                )}

                {totals.coupon && (totals.couponDiscount > 0 || totals.coupon.type === 'free_delivery') && (
                    <div className="flex justify-between items-center text-[#0D9488] font-bold">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            {t("profile.coupon")} ({totals.coupon?.code})
                        </span>
                        <span>
                            {totals.coupon.type === 'free_delivery' && (totals.couponDiscount || 0) === 0
                                ? t("profile.applied")
                                : `-₹${(totals.couponDiscount || 0).toFixed(2)}`}
                        </span>
                    </div>
                )}

                {/* Delivery & Handling Section */}
                {((totals.deliveryCharge || 0) + (totals.deliveryGST || 0)) > 0 && (
                    <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Truck className="w-3 h-3 text-primary/70" />
                            {t("cart.summary.deliveryHandling")}
                        </div>

                        {/* Standard Delivery row */}
                        {(totals.globalDeliveryCharge ?? 0) > 0 && (
                            <div className="flex justify-between items-center pl-1 group/del">
                                <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                    {t("cart.summary.standardDelivery")}
                                    <span className="text-[9px] opacity-50 font-normal">({t("profile.nonRefundable")})</span>
                                    {(totals.globalDeliveryGST ?? 0) > 0 && (
                                        <span className="text-[8px] uppercase tracking-wider text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-1 py-0 rounded-sm font-bold">
                                            {t("profile.inclTax")}
                                        </span>
                                    )}
                                </span>
                                <span className="font-bold text-xs">
                                    ₹{((totals.globalDeliveryCharge ?? 0) + (totals.globalDeliveryGST ?? 0)).toFixed(2)}
                                </span>
                            </div>
                        )}

                        {/* Item Surcharges (Split by Refundability) */}
                        {(() => {
                            let refundableBase = 0;
                            let refundableGst = 0;
                            let nonRefundableBase = 0;
                            let nonRefundableGst = 0;

                            items.forEach(item => {
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
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                                                {t("profile.refundableSurcharge")}
                                                {refundableGst > 0 && (
                                                    <span className="text-[8px] uppercase tracking-wider text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1 py-0 rounded-sm font-bold">
                                                        {t("profile.inclTax")}
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
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                                                {t("profile.additionalProcessing")}
                                                <span className="text-[9px] opacity-40 font-normal">({t("profile.nonRef")})</span>
                                                {nonRefundableGst > 0 && (
                                                    <span className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50/50 border border-orange-100/50 px-1 py-0 rounded-sm font-bold">
                                                        {t("profile.inclTax")}
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

                {/* Detailed Tax Breakdown */}
                {totals.tax && totals.tax.totalTax > 0 && (
                    <div className="pt-3 border-t border-dashed border-border/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Sparkles className="w-3 h-3 text-primary/70" />
                            {t("profile.taxBreakdownGst")}
                        </div>

                        {totals.tax.isInterState ? (
                            <div className="flex justify-between items-center pl-1 group/del">
                                <span className="text-muted-foreground text-xs font-medium">{t("profile.igstFull")}</span>
                                <span className="font-bold text-xs">₹{totals.tax.igst.toFixed(2)}</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center pl-1 group/del">
                                    <span className="text-muted-foreground text-xs font-medium">{t("profile.cgstFull")}</span>
                                    <span className="font-bold text-xs">₹{totals.tax.cgst.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pl-1 group/del">
                                    <span className="text-muted-foreground text-xs font-medium">{t("profile.sgstFull")}</span>
                                    <span className="font-bold text-xs">₹{totals.tax.sgst.toFixed(2)}</span>
                                </div>
                            </>
                        )}

                        <div className="flex justify-between items-center px-1 pt-1 border-t border-border/5">
                            <span className="text-[10px] text-muted-foreground font-medium italic">{t("profile.totalTaxIncluded")}</span>
                            <span className="text-[10px] text-muted-foreground/80 font-bold">₹{totals.tax.totalTax.toFixed(2)}</span>
                        </div>

                        {/* Product-wise Tax Breakdown (Collapsible/Inline) */}
                        {items && items.length > 0 && (
                            <div className="mt-1">
                                <details className="group px-1">
                                    <summary className="text-[9px] text-primary cursor-pointer hover:opacity-80 transition-opacity mb-1 list-none flex items-center gap-1 font-bold uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/30 group-open:bg-primary transition-colors animate-pulse" />
                                        <span>{t("profile.viewProductWiseTax")}</span>
                                    </summary>
                                    <div className="bg-muted/30 rounded-xl p-3 space-y-2.5 mt-2 max-h-[160px] overflow-y-auto custom-scrollbar border border-border/10 shadow-inner">
                                        {items.map((item, idx) => {
                                            const qty = item.quantity || 1;
                                            const taxRate = item.variant?.gst_rate ?? item.product?.default_gst_rate ?? item.gst_rate ?? 0;
                                            const title = item.product?.title || item.title || t("cart.item");

                                            // Estimation if exact tax values not in item
                                            const sellingPrice = item.variant?.selling_price ?? item.product?.price ?? item.price ?? 0;
                                            const itemTotal = sellingPrice * qty;
                                            const itemTax = itemTotal - (itemTotal / (1 + (taxRate / 100)));

                                            if (taxRate <= 0) return null;

                                            return (
                                                <div key={idx} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                                                        <span className="truncate max-w-[140px]">{title}</span>
                                                        <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">{taxRate}% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 opacity-80">
                                                        <span>{t("profile.taxableAmount")}</span>
                                                        <span>₹{(itemTotal - itemTax).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 font-bold text-foreground/60">
                                                        <span>{t("profile.taxAmount")}</span>
                                                        <span>₹{itemTax.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Delivery Tax Line Items */}
                                        {(() => {
                                            const deliveryTaxItems = [];

                                            // Global GST
                                            if ((totals.globalDeliveryGST ?? 0) > 0) {
                                                deliveryTaxItems.push({
                                                    label: t("profile.standardDeliveryGst"),
                                                    amount: totals.globalDeliveryGST || 0
                                                });
                                            }

                                            // Product SPECIFIC GST
                                            let productDeliveryGSTTotal = 0;
                                            items.forEach(item => {
                                                if (item.delivery_meta?.source !== 'global') {
                                                    productDeliveryGSTTotal += (item.delivery_gst || 0);
                                                }
                                            });

                                            if (productDeliveryGSTTotal > 0) {
                                                deliveryTaxItems.push({
                                                    label: t("profile.surchargeGst"),
                                                    amount: productDeliveryGSTTotal
                                                });
                                            }

                                            return deliveryTaxItems.map((tax, idx) => (
                                                <div key={`del-tax-${idx}`} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                                                        <span>{tax.label}</span>
                                                        <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">18% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 font-bold text-foreground/60">
                                                        <span>Tax Amount</span>
                                                        <span>₹{(tax.amount || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Separator className="bg-border/60" />

            <div className="flex justify-between items-baseline pt-2">
                <span className="text-base font-black text-foreground/60 lowercase tracking-[0.1em]">{t("profile.totalPayable")}</span>
                <span className="text-4xl font-black text-primary font-playfair leading-none tracking-tighter">
                    ₹{(totals.finalAmount || 0).toFixed(2)}
                </span>
            </div>

            {totalSavings > 0 && (
                <div className="bg-[#F0FDFA] text-[#0D9488] text-[11px] px-3 py-2.5 rounded-xl text-center font-black border border-[#CCFBF1] shadow-sm animate-in zoom-in-95">
                    {t("profile.savingsShort", { amount: `₹${totalSavings.toFixed(2)}` })}
                </div>
            )}
        </div>
    );
}

