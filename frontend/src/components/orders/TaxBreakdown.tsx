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
    invoiceUrl
}: TaxBreakdownProps) {
    const totalTax = (totalCgst || 0) + (totalSgst || 0) + (totalIgst || 0);
    const isInterState = (totalIgst || 0) > 0;
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
            <CardContent className="space-y-2">
                {hasTax ? (
                    <>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Taxable Amount</span>
                            <span>{formatAmount(totalTaxableAmount)}</span>
                        </div>

                        {isInterState ? (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">IGST</span>
                                <span>{formatAmount(totalIgst)}</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">CGST</span>
                                    <span>{formatAmount(totalCgst)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">SGST</span>
                                    <span>{formatAmount(totalSgst)}</span>
                                </div>
                            </>
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
