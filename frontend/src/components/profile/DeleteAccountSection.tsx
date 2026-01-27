import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
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
                <CardTitle className="text-destructive">{t("profile.deleteAccount.title")}</CardTitle>
                <CardDescription>
                    {t("profile.deleteAccount.desc")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                        <AlertTriangle className="h-5 w-5" />
                        <span>{t("profile.deleteAccount.warning")}</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-7">
                        <li>• {t("profile.deleteAccount.dataList.login")}</li>
                        <li>• {t("profile.deleteAccount.dataList.addresses")}</li>
                        <li>• {t("profile.deleteAccount.dataList.cart")}</li>
                    </ul>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full md:w-auto">
                            {t("profile.deleteAccount.button")}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("profile.deleteAccount.confirmTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("profile.deleteAccount.confirmDesc")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("profile.deleteAccount.confirmCancel")}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={loading}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t("profile.deleteAccount.confirmDelete")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
