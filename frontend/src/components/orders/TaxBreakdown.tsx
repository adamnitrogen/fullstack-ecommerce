/**
 * Tax Breakdown Component
 * Displays GST tax details in orders
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, FileText, Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaxBreakdownProps {
    totalTaxableAmount?: number;
    totalCgst?: number;
    totalSgst?: number;
    totalIgst?: number;
    totalAmount: number;
    compact?: boolean;
    showInvoiceLink?: boolean;
    invoiceUrl?: string;
}

export function TaxBreakdown({
    totalTaxableAmount,
    totalCgst,
    totalSgst,
    totalIgst,
    totalAmount,
    compact = false,
    showInvoiceLink = false,
    invoiceUrl,
    items = [],
    deliveryCharge = 0,
    deliveryGST = 0
}: TaxBreakdownProps & { items?: any[], deliveryCharge?: number, deliveryGST?: number }) {
    const isInterState = (totalIgst || 0) > 0;
    const totalTax = isInterState
        ? (totalIgst || 0) + (deliveryGST || 0)
        : (totalCgst || 0) + (totalSgst || 0) + (deliveryGST || 0);
    const hasTax = totalTax > 0;

    if (!hasTax && compact) {
        return null;
    }

    const formatAmount = (amount: number | undefined) => {
        if (amount === undefined || amount === null) return "₹0.00";
        return `₹${amount.toFixed(2)}`;
    };

    if (compact) {
        return (
            <div className="text-sm text-muted-foreground">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                                <Info size={14} />
                                <span>GST: {formatAmount(totalTax)}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-xs space-y-1">
                                <p>Taxable: {formatAmount(totalTaxableAmount)}</p>
                                {isInterState ? (
                                    <p>IGST: {formatAmount(totalIgst)}</p>
                                ) : (
                                    <>
                                        <p>CGST: {formatAmount(totalCgst)}</p>
                                        <p>SGST: {formatAmount(totalSgst)}</p>
                                    </>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <FileText size={18} />
                    Tax Summary
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {hasTax ? (
                    <>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Taxable Amount</span>
                                <span>{formatAmount(totalTaxableAmount)}</span>
                            </div>

                            {isInterState ? (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">IGST</span>
                                    <span>{formatAmount((totalIgst || 0) + (deliveryGST || 0))}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">CGST</span>
                                        <span>{formatAmount((totalCgst || 0) + ((deliveryGST || 0) / 2))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">SGST</span>
                                        <span>{formatAmount((totalSgst || 0) + ((deliveryGST || 0) / 2))}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Item-wise Breakdown */}
                        {items && items.length > 0 && (
                            <div className="border rounded-md overflow-hidden text-xs">
                                <div className="bg-muted px-3 py-2 font-medium flex justify-between items-center cursor-pointer hover:bg-muted/80 transition-colors group">
                                    <span>Product-wise Breakdown</span>
                                </div>
                                <div className="divide-y max-h-[200px] overflow-y-auto">
                                    {items.map((item, idx) => {
                                        // Calculate item tax details
                                        const qty = item.quantity || 1;
                                        // Try to get tax values from item logic or estimate
                                        const taxRate = item.variant?.gst_rate ?? item.product?.gst_rate ?? item.gst_rate ?? 0;
                                        const hsn = item.variant?.hsn_code ?? item.product?.hsn_code ?? item.hsn_code ?? 'N/A';

                                        // If backend provides these directly:
                                        const itemTaxable = item.taxable_amount ?? (item.price_per_unit || item.price || 0) * qty / (1 + (taxRate / 100));
                                        const itemTax = (item.total_cgst || 0) + (item.total_sgst || 0) + (item.total_igst || 0) > 0
                                            ? (item.total_cgst || 0) + (item.total_sgst || 0) + (item.total_igst || 0)
                                            : ((item.price_per_unit || item.price || 0) * qty) - itemTaxable;

                                        if (taxRate === 0 && itemTax <= 0) return null;

                                        return (
                                            <div key={idx} className="px-3 py-2 hover:bg-muted/30">
                                                <div className="flex justify-between font-medium mb-1">
                                                    <span className="truncate max-w-[180px]" title={item.title || item.product?.title}>{item.title || item.product?.title}</span>
                                                    <span>{taxRate}% GST</span>
                                                </div>
                                                <div className="flex justify-between text-muted-foreground text-[10px]">
                                                    <span>Taxable: {formatAmount(itemTaxable)}</span>
                                                    <span>Tax: {formatAmount(itemTax)}</span>
                                                </div>
                                                {hsn !== 'N/A' && (
                                                    <div className="text-[9px] text-muted-foreground mt-0.5">HSN: {hsn}</div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Explicit Delivery Line Item */}
                                    {((deliveryCharge ?? 0) > 0 || (deliveryGST ?? 0) > 0) && (
                                        <div className="px-3 py-2 hover:bg-muted/30 border-t border-dashed bg-muted/10">
                                            <div className="flex justify-between font-medium mb-1">
                                                <span>Delivery Charges</span>
                                                <span>18% GST</span>
                                            </div>
                                            <div className="flex justify-between text-muted-foreground text-[10px]">
                                                <span>Taxable: {formatAmount(deliveryCharge)}</span>
                                                <span>Tax: {formatAmount(deliveryGST)}</span>
                                            </div>
                                            <div className="text-[9px] text-muted-foreground mt-0.5">HSN: 996812</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Total Tax</span>
                                <span>{formatAmount(totalTax)}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                        No GST applicable
                    </p>
                )}

                <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                        <span>Order Total</span>
                        <span className="flex items-center">
                            <IndianRupee size={14} />
                            {totalAmount.toFixed(2)}
                        </span>
                    </div>
                </div>

                {showInvoiceLink && invoiceUrl && (
                    <div className="pt-2">
                        <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                            <FileText size={14} />
                            Download GST Invoice
                        </a>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default TaxBreakdown;
