
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { validators, ValidationError } from "@/lib/validation";
import { FormError } from "@/components/ui/form-error";
import { toast } from "@/hooks/use-toast";
import { FcGoogle } from "react-icons/fc";
import { validateCredentials, verifyLoginOtp } from "@/lib/services/auth.service";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/errorUtils";

interface LoginFormProps {
  emailOrPhone?: string;
  showPasswordField?: boolean;
  onSubmit?: (value: string) => void;
  onPasswordSubmit?: (password: string) => void;
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
  onBack?: () => void;
  onGoogleSignIn?: () => void;
}

export function LoginForm({
  emailOrPhone: initialEmailOrPhone = "",
  showPasswordField = false,
  onSubmit,
  onPasswordSubmit,
  onSwitchToRegister,
  onForgotPassword,
  onBack,
  onGoogleSignIn,
}: LoginFormProps) {
  const { t } = useTranslation();
  const { login } = useAuthStore();

  const [emailOrPhone, setEmailOrPhone] = useState(initialEmailOrPhone);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [errors, setErrors] = useState<ValidationError>({});

  const validateEmailOrPhone = (value: string): string | null => {
    const requiredError = validators.required(value, "Email or Phone");
    if (requiredError) return requiredError;

    // Check if it's email or phone
    const emailError = validators.email(value);
    const phoneError = validators.phone(value);

    // Valid if either email or phone is valid
    if (!emailError || !phoneError) {
      return null;
    }

    return "Please enter a valid email address or 10-digit phone number";
  };

  const handleEmailOrPhoneChange = (value: string) => {
    setEmailOrPhone(value);
    setErrors((prev) => ({ ...prev, emailOrPhone: undefined }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setErrors((prev) => ({ ...prev, password: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate based on current step
    const newErrors: ValidationError = {};
    let isValid = true;

    if (showOtp) {
      if (!otp || otp.length < 6) {
        newErrors.otp = "Please enter a valid 6-digit OTP";
        isValid = false;
      }
    } else if (!showPasswordField) {
      const emailOrPhoneError = validateEmailOrPhone(emailOrPhone);
      if (emailOrPhoneError) {
        newErrors.emailOrPhone = emailOrPhoneError;
        isValid = false;
      }
    } else {
      const passwordError =
        validators.required(password, "Password") ||
        validators.minLength(password, 6, "Password");
      if (passwordError) {
        newErrors.password = passwordError;
        isValid = false;
      }
    }

    setErrors(newErrors);

    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before continuing",
        variant: "destructive",
      });
      return;
    }

    // 2. Handle Logic
    setIsLoading(true);
    try {
      if (showOtp) {
        // Step 3: Verify OTP
        const user = await verifyLoginOtp(emailOrPhone, otp);
        login(user); // Auth Store Login
        toast({ title: "Login Successful", description: `Welcome back, ${user.name}!` });

        // Notify parent if needed, or redirect via Auth logic
        if (onPasswordSubmit) onPasswordSubmit("otp_verified_placeholder");
        // We pass a placeholder because the parent might expect a password, but we've already done the auth.
        // Ideally parent (Auth.tsx) just closes modal or redirects on auth state change.

      } else if (showPasswordField) {
        // Step 2: Validate Credentials (Password)
        const res = await validateCredentials(emailOrPhone, password);
        if (res.success) {
          toast({ title: "Verification Required", description: "OTP sent to your email." });
          setShowOtp(true);
        }
      } else {
        // Step 1: Check Email (Parent Logic)
        if (onSubmit) onSubmit(emailOrPhone);
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "An error occurred"),
        variant: "destructive"
      });

      if (showOtp && typeof error === 'object' && error !== null && 'attemptsRemaining' in error) {
        // Optional: show attempts remaining
        const attemptsRemaining = (error as { attemptsRemaining: number }).attemptsRemaining;
        if (attemptsRemaining !== undefined) {
          // We could show this in the toast or a separate label
        }
      }
    } finally {
      setIsLoading(false);
    }
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
          Welcome Back
        </h2>
        <p className="text-sm text-muted-foreground">Sign in to continue</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {onBack && (
          <Button
            variant="ghost"
            className="absolute top-4 left-4"
            onClick={onBack}
          >
            Back
          </Button>
        )}

        {!showOtp ? (
          /* Email/Phone + Password Step */
          <>
            <div className="space-y-2">
              <Label htmlFor="emailOrPhone">
                Email / Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="emailOrPhone"
                type="text"
                value={emailOrPhone}
                onChange={(e) => handleEmailOrPhoneChange(e.target.value)}
                placeholder="Enter your email or phone number"
                disabled={showPasswordField}
                className={errors.emailOrPhone ? "border-destructive" : ""}
              />
              <FormError error={errors.emailOrPhone} />
            </div>

            {showPasswordField && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-primary"
                    type="button"
                    onClick={onForgotPassword}
                  >
                    Forgot Password?
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Enter your password"
                  className={errors.password ? "border-destructive" : ""}
                />
                <FormError error={errors.password} />
              </div>
            )}
          </>
        ) : (
          /* OTP Step */
          <div className="space-y-2">
            <div className="text-center mb-4">
              <h3 className="font-medium">Enter OTP</h3>
              <p className="text-sm text-muted-foreground">
                We sent a verification code to {emailOrPhone}
              </p>
            </div>
            <Label htmlFor="otp">
              OTP Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(val);
                setErrors((prev) => ({ ...prev, otp: undefined }));
              }}
              placeholder="123456"
              maxLength={6}
              className={errors.otp ? "border-destructive text-center text-lg tracking-widest" : "text-center text-lg tracking-widest"}
            />
            <FormError error={errors.otp} />
            <div className="text-center mt-2">
              <Button variant="link" size="sm" type="button" onClick={() => setShowOtp(false)}>Back to Login</Button>
            </div>
          </div>
        )}

        {!showOtp && (
          <p className="text-xs text-muted-foreground text-center">
            By continuing, you agree to our{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-xs text-primary"
              type="button"
              onClick={() => window.open("/terms", "_blank")}
            >
              Terms of Use
            </Button>{" "}
            and{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-xs text-primary"
              type="button"
              onClick={() => window.open("/privacy", "_blank")}
            >
              Privacy Policy
            </Button>
            .
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? "Please wait..." : (showOtp ? "Verify & Login" : (showPasswordField ? "Sign In" : "Continue"))}
        </Button>
      </form>

      {/* Divider */}
      {!showPasswordField && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>
      )}

      {/* Google OAuth */}
      {!showPasswordField && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          size="lg"
          onClick={onGoogleSignIn}
        >
          <FcGoogle className="h-5 w-5" />
          Continue with Google
        </Button>
      )}

      {/* Switch to Register */}
      <p className="text-center mt-6 text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Button
          variant="link"
          className="px-1 text-primary"
          onClick={onSwitchToRegister}
        >
          Register here
        </Button>
      </p>

      {/* Social Media Links */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-center text-xs text-muted-foreground mb-3">
          Follow Us
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Facebook className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Twitter className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Instagram className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Youtube className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
