import { Card, CardContent } from "@/components/ui/card";
import { FileCheck, BadgePercent, Download } from "lucide-react";

export const TaxBenefitsCard = () => {
    return (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200 dark:border-green-800 shadow-sm">
            <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className="flex-shrink-0 p-3 bg-green-100 dark:bg-green-900/40 rounded-full text-green-700 dark:text-green-400">
                    <BadgePercent className="w-8 h-8" />
                </div>

                <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        Tax Exemption Benefit
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-600 text-white tracking-wider">
                            80G Certified
                        </span>
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Your donation is eligible for a **50% tax deduction** under Section 80G of the Income Tax Act.
                        You will receive a tax-compliant receipt immediately after payment.
                    </p>

                    <div className="flex flex-wrap gap-4 pt-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                            <FileCheck className="w-4 h-4" />
                            <span>Instant Receipt</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                            <Download className="w-4 h-4" />
                            <span>Annual Statement</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
