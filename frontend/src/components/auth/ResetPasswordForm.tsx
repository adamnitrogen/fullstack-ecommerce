import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { validators } from "@/lib/validation";

interface ResetPasswordFormProps {
  emailOrPhone: string;
  onSubmit: (password: string) => void;
  onBack: () => void;
}

export function ResetPasswordForm({
  emailOrPhone,
  onSubmit,
  onBack,
}: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    const passErr = validators.password(password);
    if (passErr) {
      toast({
        title: "Error",
        description: passErr,
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    // Mock password reset API call
    setTimeout(() => {
      toast({
        title: "Success",
        description:
          "Password has been reset successfully. Please login with your new password.",
      });
      setIsResetting(false);
      onSubmit(password);
    }, 1500);
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-3xl">🐄</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Reset Password
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your new password for {emailOrPhone}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            minLength={8}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isResetting}
        >
          {isResetting ? "Resetting..." : "Reset Password"}
        </Button>
        <Button
          variant="link"
          className="w-full"
          size="sm"
          onClick={onBack}
          disabled={isResetting}
        >
          Back
        </Button>
      </form>
    </div>
  );
}
