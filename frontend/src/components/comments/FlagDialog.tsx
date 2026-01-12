import { logger } from "@/lib/logger";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface FlagDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string, details: string) => Promise<void>;
}

const FLAG_REASONS = [
    { value: 'spam', label: 'Spam or unwanted commercial content' },
    { value: 'offensive', label: 'Offensive, hateful, or abusive language' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'misinformation', label: 'Misinformation or fake news' },
    { value: 'inappropriate', label: 'Sexually explicit or inappropriate' },
    { value: 'copyright', label: 'Copyright violation' },
    { value: 'personal_info', label: 'Contains private personal information' },
    { value: 'other', label: 'Other issue' },
];

export const FlagDialog = ({ isOpen, onClose, onSubmit }: FlagDialogProps) => {
    const [reason, setReason] = useState<string>("");
    const [details, setDetails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason) return;

        try {
            setIsSubmitting(true);
            await onSubmit(reason, details);
            onClose();
            // Reset form
            setReason("");
            setDetails("");
        } catch (error) {
            logger.error("Failed to flag comment:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Report Comment</DialogTitle>
                    <DialogDescription>
                        Help us keep the community safe. Why are you reporting this comment?
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger id="reason">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {FLAG_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="details">Additional Details (Optional)</Label>
                        <Textarea
                            id="details"
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder="Provide more context if needed..."
                            rows={3}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!reason || isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Submit Report"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
