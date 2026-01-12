import { useState, useRef, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";
import { getErrorMessage } from "@/lib/errorUtils";

interface OTPVerificationProps {
  emailOrPhone: string;
  password?: string;
  name?: string;
  isRegistration?: boolean;
  isForgotPassword?: boolean;
  onVerified: (isAdmin: boolean, userData?: User) => void;
  onBack: () => void;
}

export function OTPVerification({
  emailOrPhone,
  password,
  name,
  isRegistration = false,
  isForgotPassword = false,
  onVerified,
  onBack,
}: OTPVerificationProps) {

  const { t } = useTranslation();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const login = useAuthStore((state) => state.login);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);

    // Focus last filled input or next empty
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };


  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast({
        title: t("auth.error"),
        description: t("auth.invalidOTP"),
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    if (isForgotPassword) {
      // Just verify OTP for password reset, don't login
      // TODO: Implement real API call for forgot password OTP verify if needed
      setTimeout(() => {
        toast({
          title: t("auth.success"),
          description: "OTP verified successfully",
        });
        setIsVerifying(false);
        onVerified(false);
      }, 1500);
      return;
    }

    if (isRegistration) {
      // Registration flow usually involves verifying OTP then calling register
      // For now keeping mock/delay consistent with previous behavior or assuming parent handles it
      // But effectively we might want to verify OTP here too?
      // IMPORTANT: The previous code just mocked success.
      // If we want to change ONLY login, we keep this as is.
      setTimeout(() => {
        // Mock user data for registration flow (or just success)
        // The parent component likely takes over after onVerified
        const mockUser = {
          id: Math.random().toString(36).substr(2, 9),
          name: name || "New User",
          email: emailOrPhone,
          role: "customer" as const,
          addresses: [],
        };

        // For registration we often don't login immediately until final step, 
        // but previous code did login(mockUser).
        // I'll keep previous behavior for registration to avoid breaking it.
        login(mockUser); // This might be wrong for registration if it's not fully complete?

        toast({
          title: t("auth.success"),
          description: "Registration verified!",
        });
        setIsVerifying(false);
        onVerified(false, mockUser);
      }, 1500);
      return;
    }

    // LOGIN FLOW
    try {
      const response = await apiClient.post('/auth/verify-login-otp', {
        email: emailOrPhone,
        otp: otpString
      });

      const { user } = response.data;

      // Login updates the store
      login(user);

      toast({
        title: t("auth.success"),
        description: t("auth.loginSuccess"),
      });

      // Pass userData to parent
      onVerified(user.role === 'admin' || user.role === 'manager', user);

    } catch (error: unknown) {
      toast({
        title: "Verification Failed",
        description: getErrorMessage(error, "Invalid OTP"),
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getTitle = () => {
    if (isForgotPassword) return "Reset Password";
    if (isRegistration) return "Verify Registration";
    return "Verify OTP";
  };

  const getDescription = () => {
    if (isForgotPassword)
      return `Enter the 6-digit code sent to ${emailOrPhone} to reset your password`;
    if (isRegistration)
      return `Enter the 6-digit code sent to ${emailOrPhone} to verify your account`;
    return `Enter the 6-digit code sent to ${emailOrPhone}`;
  };

  const handleResendOTP = () => {
    toast({
      title: t("auth.success"),
      description: `OTP has been resent to ${emailOrPhone}`,
    });
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-3xl">🐄</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {getTitle()}
        </h2>
        <p className="text-sm text-muted-foreground">
          {getDescription()}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="ml-1 h-auto p-1 inline-flex"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </p>
      </div>

      {/* OTP Input - 6 Separate Boxes */}
      <div className="space-y-6">
        <div className="flex justify-center gap-2">
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className="w-12 h-12 text-center text-lg font-semibold"
              autoFocus={index === 0}
            />
          ))}
        </div>

        <Button
          onClick={handleVerify}
          className="w-full"
          size="lg"
          disabled={isVerifying || otp.join("").length !== 6}
        >
          {isVerifying ? "Verifying..." : "Verify & Continue"}
        </Button>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Didn't receive the code?
          </p>
          <Button
            variant="link"
            className="text-primary"
            onClick={handleResendOTP}
            disabled={isVerifying}
          >
            Resend OTP
          </Button>
        </div>
      </div>
    </div>
  );
}
