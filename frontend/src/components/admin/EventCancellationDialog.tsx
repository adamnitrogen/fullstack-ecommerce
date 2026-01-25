import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface EventCancellationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    title?: string;
    description?: string;
    warningText?: string;
    confirmLabel?: string;
    isLoading?: boolean;
    isUser?: boolean;
}

const CUSTOMER_REASONS = [
    "Scheduling Conflict",
    "Personal Emergency",
    "Health Issues",
    "Travel/Transportation Issues",
    "No longer interested",
    "Other (please specify below)"
];

const ADMIN_REASONS = [
    "Event Postponed with Uncertain Schedule",
    "Venue Issue",
    "Presenter Unavailability",
    "Low Attendance",
    "Technical/System Error",
    "Other (please specify below)"
];

export function EventCancellationDialog({
    isOpen,
    onClose,
    onConfirm,
    title = "Cancel Event",
    description = "Please provide a reason for cancelling this event.",
    warningText = "This action is irreversible. All registrations will be cancelled and refunds will be initiated automatically for paid registrations.",
    confirmLabel = "Confirm Cancellation",
    isLoading = false,
    isUser = false
}: EventCancellationDialogProps) {
    const [selectedReason, setSelectedReason] = useState("");
    const [otherReason, setOtherReason] = useState("");

    const reasons = useMemo(() => isUser ? CUSTOMER_REASONS : ADMIN_REASONS, [isUser]);
    const isOtherSelected = selectedReason === "Other (please specify below)";

    // Word count calculation
    const wordCount = useMemo(() => {
        if (!otherReason.trim()) return 0;
        return otherReason.trim().split(/\s+/).filter(word => word.length > 0).length;
    }, [otherReason]);

    const isValidationValid = useMemo(() => {
        if (!selectedReason) return false;
        if (isOtherSelected) {
            return wordCount >= 10;
        }
        return true;
    }, [selectedReason, isOtherSelected, wordCount]);

    const handleConfirm = async () => {
        if (!isValidationValid) return;

        const finalReason = isOtherSelected ? otherReason.trim() : selectedReason;
        await onConfirm(finalReason);

        // Reset states
        setSelectedReason("");
        setOtherReason("");
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
            // Optional: reset state on close?
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-[1.5rem] border-none shadow-2xl">
                <DialogHeader className="space-y-3">
                    <DialogTitle className="text-destructive flex items-center gap-2 text-2xl font-playfair font-bold">
                        <AlertCircle className="h-6 w-6" />
                        {title}
                    </DialogTitle>
                    <DialogDescription className="text-base">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2 space-y-6">
                    <Alert variant="destructive" className="bg-red-50 border-red-100 rounded-2xl">
                        <Info className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-800 font-bold">Important Notice</AlertTitle>
                        <AlertDescription className="text-red-700 font-medium">
                            {warningText}
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                Reason for Cancellation
                            </label>
                            <Select onValueChange={setSelectedReason} value={selectedReason}>
                                <SelectTrigger className="h-12 rounded-xl border-border/50 focus:ring-[#B85C3C] bg-muted/20">
                                    <SelectValue placeholder="Select a reason" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/50 shadow-xl">
                                    {reasons.map((r) => (
                                        <SelectItem key={r} value={r} className="rounded-lg my-1">
                                            {r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {isOtherSelected && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                        Detailed Description
                                    </label>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${wordCount >= 10 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {wordCount} / 10 words min
                                    </span>
                                </div>
                                <Textarea
                                    placeholder="Please provide more details (minimum 10 words)..."
                                    value={otherReason}
                                    onChange={(e) => setOtherReason(e.target.value)}
                                    className="min-h-[120px] rounded-2xl border-border/50 focus:ring-[#B85C3C] bg-muted/10 p-4 resize-none"
                                    autoFocus
                                />
                                {wordCount > 0 && wordCount < 10 && (
                                    <p className="text-[10px] text-orange-600 font-medium ml-1">
                                        Please add {10 - wordCount} more word{10 - wordCount === 1 ? '' : 's'}.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="rounded-full px-8 border-border/50 hover:bg-muted font-bold uppercase tracking-widest text-[10px] h-11"
                    >
                        Abort
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isLoading || !isValidationValid}
                        className="rounded-full px-8 bg-destructive hover:bg-destructive/90 font-bold uppercase tracking-widest text-[10px] h-11 shadow-lg shadow-destructive/20 transition-all hover:scale-105 active:scale-95 disabled:scale-100"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
