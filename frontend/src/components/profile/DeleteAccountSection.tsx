import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

interface DeleteAccountSectionProps {
    onDelete: () => Promise<void>;
}

export default function DeleteAccountSection({ onDelete }: DeleteAccountSectionProps) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            await onDelete();
        } catch (error) {
            logger.error('Error deleting account:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-destructive/50">
            <CardHeader>
                <CardTitle className="text-destructive">Delete Account</CardTitle>
                <CardDescription>
                    Permanently delete your account and all associated data
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Warning: This action cannot be undone</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-7">
                        <li>• Personal profile and login details</li>
                        <li>• Saved addresses and payment methods</li>
                        <li>• Shopping cart and wishlist items</li>
                    </ul>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full md:w-auto">
                            Delete My Account
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete your account. Your comments and reviews will remain visible, but you will lose access to your account and all personal data will be removed.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={loading}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Yes, Delete My Account
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
