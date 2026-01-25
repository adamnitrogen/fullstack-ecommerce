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
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
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
                title: t("profile.recurringDonations.cancelled"),
                description: t("profile.recurringDonations.cancelledDesc"),
            });
            setSelectedSubId(null);
        },
        onError: (error: unknown) => {
            toast({
                title: t("profile.recurringDonations.cancelFailed"),
                description: getErrorMessage(error, t("profile.recurringDonations.cancelFailedDesc")),
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
                title: t("profile.recurringDonations.paused"),
                description: t("profile.recurringDonations.pausedDesc"),
            });
        },
        onError: (error: unknown) => {
            toast({
                title: t("profile.recurringDonations.pauseFailed"),
                description: getErrorMessage(error, t("profile.recurringDonations.pauseFailedDesc")),
                variant: "destructive",
            });
        },
    });

    const resumeMutation = useMutation({
        mutationFn: donationService.resumeSubscription,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mySubscriptions"] });
            toast({
                title: t("profile.recurringDonations.resumed"),
                description: t("profile.recurringDonations.resumedDesc"),
            });
        },
        onError: (error: unknown) => {
            toast({
                title: t("profile.recurringDonations.resumeFailed"),
                description: getErrorMessage(error, t("profile.recurringDonations.resumeFailedDesc")),
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
                        <CardTitle>{t("profile.recurringDonations.title")}</CardTitle>
                    </div>
                    <CardDescription>
                        {t("profile.recurringDonations.noActive")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Heart className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>{t("profile.recurringDonations.considerStarting")}</p>
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
                        <CardTitle>{t("profile.recurringDonations.title")}</CardTitle>
                    </div>
                    <CardDescription>
                        {t("profile.recurringDonations.manageDesc")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("profile.recurringDonations.refId")}</TableHead>
                                <TableHead>{t("profile.recurringDonations.amount")}</TableHead>
                                <TableHead>{t("profile.recurringDonations.status")}</TableHead>
                                <TableHead>{t("profile.recurringDonations.nextBilling")}</TableHead>
                                <TableHead className="text-right">{t("profile.recurringDonations.actions")}</TableHead>
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
                                            : (sub.status === 'created' ? t("profile.recurringDonations.pendingFirst") : t("profile.recurringDonations.na"))}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {sub.status === 'paused' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => resumeMutation.mutate(sub.razorpay_subscription_id)}
                                                disabled={resumeMutation.isPending}
                                            >
                                                {t("profile.recurringDonations.resume")}
                                            </Button>
                                        )}

                                        {(sub.status === 'active' || sub.status === 'authenticated') && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => pauseMutation.mutate(sub.razorpay_subscription_id)}
                                                disabled={pauseMutation.isPending}
                                            >
                                                {t("profile.recurringDonations.pause")}
                                            </Button>
                                        )}

                                        {(sub.status === 'active' || sub.status === 'created' || sub.status === 'authenticated' || sub.status === 'paused') && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleCancelClick(sub.razorpay_subscription_id)}
                                                disabled={cancelMutation.isPending}
                                            >
                                                {t("profile.recurringDonations.cancel")}
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
                        <AlertDialogTitle>{t("profile.recurringDonations.stopTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("profile.recurringDonations.stopDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("profile.recurringDonations.keepActive")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmCancel}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {cancelMutation.isPending ? t("profile.recurringDonations.cancelling") : t("profile.recurringDonations.confirmStop")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
