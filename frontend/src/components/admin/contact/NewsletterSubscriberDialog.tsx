import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newsletterService, NewsletterSubscriber } from "@/services/newsletter.service";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewsletterSubscriberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subscriber?: NewsletterSubscriber | null;
}

export function NewsletterSubscriberDialog({
    open,
    onOpenChange,
    subscriber,
}: NewsletterSubscriberDialogProps) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");

    const { toast } = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (subscriber) {
            setEmail(subscriber.email);
            setName(subscriber.name || "");
        } else {
            setEmail("");
            setName("");
        }
    }, [subscriber, open]);

    const createMutation = useMutation({
        mutationFn: (data: { email: string; name?: string }) =>
            newsletterService.createSubscriber(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
            queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
            toast({ title: "Subscriber added successfully" });
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast({
                title: "Failed to add subscriber",
                description: getErrorMessage(error, "Failed to add subscriber"),
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; updates: Partial<NewsletterSubscriber> }) =>
            newsletterService.updateSubscriber(data.id, data.updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
            queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
            toast({ title: "Subscriber updated successfully" });
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast({
                title: "Failed to update subscriber",
                description: getErrorMessage(error, "Failed to update subscriber"),
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast({
                title: "Error",
                description: "Email is required",
                variant: "destructive",
            });
            return;
        }

        const subscriberData = {
            email: email.trim(),
            name: name.trim() || undefined,
        };

        if (subscriber) {
            updateMutation.mutate({ id: subscriber.id, updates: subscriberData });
        } else {
            createMutation.mutate(subscriberData);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {subscriber ? "Edit Subscriber" : "Add New Subscriber"}
                    </DialogTitle>
                    <DialogDescription>
                        {subscriber
                            ? "Update the subscriber's information"
                            : "Add a new newsletter subscriber"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">
                            Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="subscriber@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Name (Optional)</Label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                        >
                            {subscriber ? "Update" : "Add"} Subscriber
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
