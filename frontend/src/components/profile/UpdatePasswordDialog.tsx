import { logger } from "@/lib/logger";
import { getErrorMessage, getErrorDetails } from "@/lib/errorUtils";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "react-i18next";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/lib/services/auth.service";

const passwordSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[a-z]/, "Password must contain at least one lowercase letter")
            .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
            .regex(/[0-9]/, "Password must contain at least one number")
            .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
        message: "New password cannot be the same as your current password",
        path: ["newPassword"],
    });

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface UpdatePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isGoogleAuth?: boolean;
}

export function UpdatePasswordDialog({
    open,
    onOpenChange,
    isGoogleAuth = false,
}: UpdatePasswordDialogProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const onSubmit = async (data: PasswordFormValues) => {
        setLoading(true);
        try {
            await changePassword({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });
            toast.success("Password updated successfully");
            form.reset();
            onOpenChange(false);
        } catch (error: unknown) {
            logger.error("Password update error:", error);
            const details = getErrorDetails(error);
            if (details) {
                details.forEach((d) => {
                    const field = d.path?.[0];
                    if (field && (field === 'currentPassword' || field === 'newPassword' || field === 'confirmPassword')) {
                        form.setError(field as keyof PasswordFormValues, { message: d.message });
                    }
                });
            } else {
                toast.error(getErrorMessage(error, "Failed to update password"));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-none shadow-elevated p-0 overflow-hidden">
                <div className="bg-muted/30 p-8 border-b border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-playfair text-[#2C1810]">
                            {isGoogleAuth ? "Password Not Available" : "Fortify Sanctuary"}
                        </DialogTitle>
                        <DialogDescription className="text-xs italic">
                            {isGoogleAuth
                                ? "You signed in with Google, so there is no password to change."
                                : "Rotate your sacred credentials to maintain spiritual security."
                            }
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8">
                    {isGoogleAuth ? (
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-2">
                                <svg className="w-8 h-8 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Since you signed in with Google, you don't have a password set for this account.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                To set a password, use the <strong>"Forgot Password"</strong> option on the login page.
                                This will allow you to create a password for email-based login.
                            </p>
                            <Button
                                variant="outline"
                                className="mt-4 rounded-full px-8"
                                onClick={() => onOpenChange(false)}
                            >
                                Got it
                            </Button>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="currentPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Current Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type={showCurrentPassword ? "text" : "password"}
                                                        placeholder="Enter current password"
                                                        autoComplete="current-password"
                                                        className="rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]"
                                                        {...field}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                    >
                                                        {showCurrentPassword ? (
                                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="newPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>New Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type={showNewPassword ? "text" : "password"}
                                                        placeholder="Enter new password"
                                                        autoComplete="new-password"
                                                        className="rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]"
                                                        {...field}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                                    >
                                                        {showNewPassword ? (
                                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirm New Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        placeholder="Confirm new password"
                                                        className="rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]"
                                                        {...field}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    >
                                                        {showConfirmPassword ? (
                                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-dashed border-border/60 mt-6">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => onOpenChange(false)}
                                        disabled={loading}
                                        className="rounded-full px-8 font-bold text-xs uppercase tracking-widest"
                                    >
                                        Retreat
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="rounded-full bg-[#2C1810] hover:bg-[#B85C3C] text-white px-10 font-bold text-xs uppercase tracking-widest shadow-lg transition-all"
                                    >
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Fortify Path
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
