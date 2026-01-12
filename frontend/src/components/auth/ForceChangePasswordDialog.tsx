import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { getErrorMessage } from "@/lib/errorUtils";

export function ForceChangePasswordDialog() {
    const { user, updateUser } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (user?.mustChangePassword) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [user?.mustChangePassword]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast({
                title: "Error",
                description: "Password must be at least 6 characters long",
                variant: "destructive"
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: "Error",
                description: "Passwords do not match",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/profile/change-password', { newPassword: password });

            updateUser({ mustChangePassword: false });
            setOpen(false);

            toast({
                title: "Success",
                description: "Password updated successfully"
            });

            // Clear form
            setPassword("");
            setConfirmPassword("");
        } catch (error: unknown) {
            toast({
                title: "Failed to update password",
                description: getErrorMessage(error, "An error occurred"),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    // Prevent closing without updating
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && user?.mustChangePassword) {
            return;
        }
        setOpen(newOpen);
    };

    if (!user?.mustChangePassword) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="sm:max-w-md"
                onPointerDownOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
            // Hide close button via CSS or if className allows hacking it, but ideally we should be robust
            // Typically shadcn dialog has a Close component usage internally.
            >
                <DialogHeader>
                    <DialogTitle>Change Password Required</DialogTitle>
                    <DialogDescription>
                        For your security, you must update your password before accessing your account.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Enter new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <div className="relative">
                            <Input
                                id="confirm-password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Confirm new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? "Updating..." : "Update Password"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
