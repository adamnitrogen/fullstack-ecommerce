import React, { useState, useMemo } from 'react';
import { useTranslation } from "react-i18next";
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
    { value: "Scheduling Conflict", labelKey: "admin.events.cancellationReasons.customer.schedulingConflict" },
    { value: "Personal Emergency", labelKey: "admin.events.cancellationReasons.customer.personalEmergency" },
    { value: "Health Issues", labelKey: "admin.events.cancellationReasons.customer.healthIssues" },
    { value: "Travel/Transportation Issues", labelKey: "admin.events.cancellationReasons.customer.travelIssues" },
    { value: "No longer interested", labelKey: "admin.events.cancellationReasons.customer.notInterested" },
    { value: "Other (please specify below)", labelKey: "admin.events.cancellationReasons.customer.other" }
];

const ADMIN_REASONS = [
    { value: "Event Postponed with Uncertain Schedule", labelKey: "admin.events.cancellationReasons.admin.postponed" },
    { value: "Venue Issue", labelKey: "admin.events.cancellationReasons.admin.venueIssue" },
    { value: "Presenter Unavailability", labelKey: "admin.events.cancellationReasons.admin.presenterUnavailability" },
    { value: "Low Attendance", labelKey: "admin.events.cancellationReasons.admin.lowAttendance" },
    { value: "Technical/System Error", labelKey: "admin.events.cancellationReasons.admin.technicalError" },
    { value: "Other (please specify below)", labelKey: "admin.events.cancellationReasons.admin.other" }
];

export function EventCancellationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    warningText,
    confirmLabel,
    isLoading = false,
    isUser = false
}: EventCancellationDialogProps) {
    const { t } = useTranslation();

    // Default values if props are not provided
    const displayTitle = title || t("admin.events.dialogs.cancelDialog.title");
    const displayDescription = description || t("admin.events.dialogs.cancelDialog.desc");
    const displayWarning = warningText || t("admin.events.dialogs.cancelDialog.warning");
    const displayConfirmLabel = confirmLabel || t("admin.events.dialogs.cancelDialog.title");
    const [selectedReason, setSelectedReason] = useState("");
    const [otherReason, setOtherReason] = useState("");

    const reasons = useMemo(() => isUser ? CUSTOMER_REASONS : ADMIN_REASONS, [isUser]);
    const isOtherSelected = selectedReason === "Other (please specify below)" || selectedReason === t("admin.events.dialogs.cancelDialog.reasonPlaceholder"); // Fallback for localized "Other"

    // In a real app we'd translate these properly, but for now we match the string or use a key.
    // Let's assume the selection value is what gets sent back.

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
                        {displayTitle}
                    </DialogTitle>
                    <DialogDescription className="text-base">
                        {displayDescription}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2 space-y-6">
                    <Alert variant="destructive" className="bg-red-50 border-red-100 rounded-2xl">
                        <Info className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-800 font-bold">{t("admin.events.dialogs.cancelDialog.noticeTitle")}</AlertTitle>
                        <AlertDescription className="text-red-700 font-medium">
                            {displayWarning}
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                {t("admin.events.dialogs.cancelDialog.reasonLabel")}
                            </label>
                            <Select onValueChange={setSelectedReason} value={selectedReason}>
                                <SelectTrigger className="h-12 rounded-xl border-border/50 focus:ring-[#B85C3C] bg-muted/20">
                                    <SelectValue placeholder={t("admin.events.dialogs.cancelDialog.reasonPlaceholder")} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border/50 shadow-xl">
                                    {reasons.map((r) => (
                                        <SelectItem key={r.value} value={r.value} className="rounded-lg my-1">
                                            {t(r.labelKey)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {isOtherSelected && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                        {t("admin.events.dialogs.cancelDialog.otherLabel")}
                                    </label>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${wordCount >= 10 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {t("admin.events.dialogs.cancelDialog.wordMin", { count: wordCount })}
                                    </span>
                                </div>
                                <Textarea
                                    placeholder={t("admin.events.dialogs.cancelDialog.otherPlaceholder")}
                                    value={otherReason}
                                    onChange={(e) => setOtherReason(e.target.value)}
                                    className="min-h-[120px] rounded-2xl border-border/50 focus:ring-[#B85C3C] bg-muted/10 p-4 resize-none"
                                    autoFocus
                                />
                                {wordCount > 0 && wordCount < 10 && (
                                    <p className="text-[10px] text-orange-600 font-medium ml-1">
                                        {t("admin.events.dialogs.cancelDialog.wordReq", { count: 10 - wordCount })}
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
                        {t("common.abort")}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isLoading || !isValidationValid}
                        className="rounded-full px-8 bg-destructive hover:bg-destructive/90 font-bold uppercase tracking-widest text-[10px] h-11 shadow-lg shadow-destructive/20 transition-all hover:scale-105 active:scale-95 disabled:scale-100"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {displayConfirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
