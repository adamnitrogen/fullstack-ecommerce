import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";

interface RegenerateInvoiceButtonProps {
    orderId: string;
    onSuccess?: () => void;
    className?: string;
    variant?: "outline" | "default" | "secondary" | "ghost" | "link" | "destructive";
    size?: "default" | "sm" | "lg" | "icon";
    showIconOnly?: boolean;
}

export const RegenerateInvoiceButton: React.FC<RegenerateInvoiceButtonProps> = ({
    orderId,
    onSuccess,
    className,
    variant = "outline",
    size = "sm",
    showIconOnly = false
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleRegenerate = async () => {
        try {
            setIsGenerating(true);
            toast.info("Regenerating invoice...");

            const response = await apiClient.post(`/invoices/orders/${orderId}/retry`, {});

            if (response.data.success) {
                toast.success("Invoice regenerated successfully");
                if (onSuccess) onSuccess();
            } else {
                toast.error(response.data.error || "Failed to regenerate invoice");
            }
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to regenerate invoice"));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleRegenerate}
            disabled={isGenerating}
        >
            {isGenerating ? (
                <Loader2 className={`${showIconOnly ? "" : "mr-2"} h-4 w-4 animate-spin`} />
            ) : (
                <RotateCcw className={`${showIconOnly ? "" : "mr-2"} h-4 w-4`} />
            )}
            {!showIconOnly && "Regenerate Invoice"}
        </Button>
    );
};
