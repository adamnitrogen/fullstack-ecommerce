import React, { useState } from 'react';
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
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EventCancellationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    title?: string;
    description?: string;
    warningText?: string;
    confirmLabel?: string;
    isLoading?: boolean;
}

export function EventCancellationDialog({
    isOpen,
    onClose,
    onConfirm,
    title = "Cancel Event",
    description = "Please provide a reason for cancelling this event. This reason will be visible to all registered attendees.",
    warningText = "This action is irreversible. All registrations will be cancelled and refunds will be initiated automatically for paid registrations.",
    confirmLabel = "Cancel Event",
    isLoading = false
}: EventCancellationDialogProps) {
    const [reason, setReason] = useState("");

    const handleConfirm = async () => {
        if (!reason.trim()) return;
        await onConfirm(reason);
        setReason("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-width-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                            {warningText}
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Cancellation Reason</label>
                        <Textarea
                            placeholder="Enter reason for cancellation (e.g., Unforeseen circumstances, Venue change, etc.)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[100px]"
                            autoFocus
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Abort
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isLoading || !reason.trim()}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
