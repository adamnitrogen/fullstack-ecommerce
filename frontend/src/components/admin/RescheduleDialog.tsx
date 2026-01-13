import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, AlertCircle, Loader2 } from "lucide-react";
import { format, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

interface RescheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { startDate: string; endDate?: string; reason: string }) => Promise<void>;
    event: Event | null;
    isLoading?: boolean;
}

export function RescheduleDialog({
    isOpen,
    onClose,
    onConfirm,
    event,
    isLoading = false
}: RescheduleDialogProps) {
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (event && isOpen) {
            setStartDate(new Date(event.startDate));
            setEndDate(event.endDate ? new Date(event.endDate) : undefined);
            setReason("");
        }
    }, [event, isOpen]);

    const handleConfirm = async () => {
        if (!startDate || !reason.trim()) return;

        await onConfirm({
            startDate: startDate.toISOString(),
            endDate: endDate?.toISOString(),
            reason: reason.trim()
        });
    };

    const isRescheduled = () => {
        if (!event || !startDate) return false;
        const oldStart = new Date(event.startDate).toDateString();
        const newStart = startDate.toDateString();

        if (oldStart !== newStart) return true;

        const oldEnd = event.endDate ? new Date(event.endDate).toDateString() : null;
        const newEnd = endDate ? endDate.toDateString() : null;

        return oldEnd !== newEnd;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        Reschedule Event
                    </DialogTitle>
                    <DialogDescription>
                        Change the dates for "{event?.title}". This will NOT trigger refunds, but will notify all registered users about the schedule change.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>New Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "PPP") : <span>Pick date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>New End Date (Opt)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, "PPP") : <span>Pick date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={setEndDate}
                                        initialFocus
                                        disabled={(date) => startDate ? isBefore(date, startDate) : false}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reschedule-reason">
                            Reason for Schedule Change <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="reschedule-reason"
                            placeholder="e.g. Venue availability issue, health emergency..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="resize-none"
                            rows={3}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            This message will be included in the notification email sent to all registrants.
                        </p>
                    </div>

                    {!isRescheduled() && startDate && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span>You haven't changed the dates. If you just want to update the details, use the Edit action instead.</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!startDate || !reason.trim() || !isRescheduled() || isLoading}
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Reschedule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
