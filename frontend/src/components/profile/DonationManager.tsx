import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { donationService } from "@/services/donation.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Heart } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getErrorMessage } from "@/lib/errorUtils";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Subscription {
    id: string;
    donation_reference_id: string;
    amount: number;
    status: 'active' | 'created' | 'authenticated' | 'paused' | 'cancelled';
    next_billing_at: string | null;
    razorpay_subscription_id: string;
}

export default function DonationManager() {
    const queryClient = useQueryClient();
    const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

    // Fetch subscriptions
    const { data: subscriptionsData, isLoading } = useQuery({
        queryKey: ["mySubscriptions"],
        queryFn: donationService.getSubscriptions,
    });

    const subscriptions = subscriptionsData?.subscriptions || [];

    // Cancel Mutation
    const cancelMutation = useMutation({
        mutationFn: donationService.cancelSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mySubscriptions"] });
            toast({
                title: "Subscription Cancelled",
                description: "Your recurring donation has been cancelled successfully.",
            });
            setSelectedSubId(null);
        },
        onError: (error: unknown) => {
            toast({
                title: "Cancellation Failed",
                description: getErrorMessage(error, "Could not cancel subscription."),
                variant: "destructive",
            });
            setSelectedSubId(null);
        },
    });

    const pauseMutation = useMutation({
        mutationFn: donationService.pauseSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mySubscriptions"] });
            toast({
                title: "Subscription Paused",
                description: "Your recurring donation has been paused.",
            });
        },
        onError: (error: unknown) => {
            toast({
                title: "Pause Failed",
                description: getErrorMessage(error, "Could not pause subscription."),
                variant: "destructive",
            });
        },
    });

    const resumeMutation = useMutation({
        mutationFn: donationService.resumeSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mySubscriptions"] });
            toast({
                title: "Subscription Resumed",
                description: "Your recurring donation is now active.",
            });
        },
        onError: (error: unknown) => {
            toast({
                title: "Resume Failed",
                description: getErrorMessage(error, "Could not resume subscription."),
                variant: "destructive",
            });
        },
    });

    const handleCancelClick = (subId: string) => {
        setSelectedSubId(subId);
    };

    const confirmCancel = () => {
        if (selectedSubId) {
            cancelMutation.mutate(selectedSubId);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If no recurring donations found
    if (subscriptions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5" />
                        <CardTitle>My Recurring Donations</CardTitle>
                    </div>
                    <CardDescription>
                        You have no active monthly donations.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Heart className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>Consider starting a monthly donation to support our cause continuously.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5" />
                        <CardTitle>My Recurring Donations</CardTitle>
                    </div>
                    <CardDescription>
                        Manage your monthly contributions and subscription status
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Reference ID</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Next Billing</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subscriptions.map((sub: Subscription) => (
                                <TableRow key={sub.id}>
                                    <TableCell className="font-medium font-mono text-xs">
                                        {sub.donation_reference_id}
                                    </TableCell>
                                    <TableCell>₹{sub.amount}</TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            sub.status === 'active' ? 'default' :
                                                (sub.status === 'created' || sub.status === 'authenticated') ? 'secondary' :
                                                    sub.status === 'paused' ? 'secondary' :
                                                        sub.status === 'cancelled' ? 'secondary' : 'outline'
                                        } className={sub.status === 'paused' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-transparent' : ''}>
                                            {sub.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {sub.next_billing_at
                                            ? format(new Date(sub.next_billing_at), 'PP')
                                            : (sub.status === 'created' ? 'Pending First Payment' : 'N/A')}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {sub.status === 'paused' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => resumeMutation.mutate(sub.razorpay_subscription_id)}
                                                disabled={resumeMutation.isPending}
                                            >
                                                Resume
                                            </Button>
                                        )}

                                        {(sub.status === 'active' || sub.status === 'authenticated') && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => pauseMutation.mutate(sub.razorpay_subscription_id)}
                                                disabled={pauseMutation.isPending}
                                            >
                                                Pause
                                            </Button>
                                        )}

                                        {(sub.status === 'active' || sub.status === 'created' || sub.status === 'authenticated' || sub.status === 'paused') && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleCancelClick(sub.razorpay_subscription_id)}
                                                disabled={cancelMutation.isPending}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AlertDialog open={!!selectedSubId} onOpenChange={(open) => !open && setSelectedSubId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Stop Recurring Donation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel this monthly donation?
                            You will not be charged again, but previous donations remain recorded.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep Active</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmCancel}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Donation'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
