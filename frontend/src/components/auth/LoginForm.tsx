
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Facebook, Twitter, Instagram, Youtube, ArrowLeft } from "lucide-react";
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

    const emailError = validators.email(value);
    const phoneError = validators.phone(value);

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

    setIsLoading(true);
    try {
      if (showOtp) {
        const user = await verifyLoginOtp(emailOrPhone, otp);
        login(user);
        toast({ title: "Login Successful", description: `Welcome back, ${user.name}!` });
        if (onPasswordSubmit) onPasswordSubmit("otp_verified_placeholder");
      } else if (showPasswordField) {
        const res = await validateCredentials(emailOrPhone, password);
        if (res.success) {
          toast({ title: "Verification Required", description: "OTP sent to your email." });
          setShowOtp(true);
        }
      } else {
        if (onSubmit) onSubmit(emailOrPhone);
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "An error occurred"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 bg-white">
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-[#2C1810]/60 hover:text-[#B85C3C] transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#B85C3C] to-[#D4AF37] rounded-2xl flex items-center justify-center shadow-lg shadow-[#B85C3C]/20">
            <span className="text-3xl">🐄</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#2C1810] font-playfair mb-1">
          Welcome Back
        </h2>
        <p className="text-sm text-[#2C1810]/60">Sign in to continue your journey</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {!showOtp ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="emailOrPhone" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
                Email / Phone Number <span className="text-[#B85C3C]">*</span>
              </Label>
              <Input
                id="emailOrPhone"
                type="text"
                value={emailOrPhone}
                onChange={(e) => handleEmailOrPhoneChange(e.target.value)}
                placeholder="Enter your email or phone number"
                disabled={showPasswordField}
                className={`h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white transition-colors ${errors.emailOrPhone ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
              />
              <FormError error={errors.emailOrPhone} />
            </div>

            {showPasswordField && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
                    Password <span className="text-[#B85C3C]">*</span>
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-[#B85C3C] hover:text-[#2C1810] font-medium transition-colors"
                    onClick={onForgotPassword}
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Enter your password"
                  className={`h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white transition-colors ${errors.password ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
                />
                <FormError error={errors.password} />
              </div>
            )}
          </>
        ) : (
          /* OTP Step */
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-[#B85C3C]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🔐</span>
              </div>
              <h3 className="font-bold text-[#2C1810] text-lg">Enter Verification Code</h3>
              <p className="text-sm text-[#2C1810]/60 mt-1">
                We sent a 6-digit code to <span className="font-medium text-[#B85C3C]">{emailOrPhone}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
                OTP Code <span className="text-[#B85C3C]">*</span>
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
                placeholder="• • • • • •"
                maxLength={6}
                className={`h-14 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white text-center text-2xl font-bold tracking-[0.5em] transition-colors ${errors.otp ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
              />
              <FormError error={errors.otp} />
            </div>
            <button
              type="button"
              className="text-sm text-[#B85C3C] hover:text-[#2C1810] font-medium transition-colors w-full text-center"
              onClick={() => setShowOtp(false)}
            >
              ← Back to Login
            </button>
          </div>
        )}

        {!showOtp && (
          <p className="text-[10px] text-[#2C1810]/50 text-center leading-relaxed">
            By continuing, you agree to our{" "}
            <button
              type="button"
              className="text-[#B85C3C] hover:underline font-medium"
              onClick={() => window.open("/terms", "_blank")}
            >
              Terms of Use
            </button>{" "}
            and{" "}
            <button
              type="button"
              className="text-[#B85C3C] hover:underline font-medium"
              onClick={() => window.open("/privacy", "_blank")}
            >
              Privacy Policy
            </button>
            .
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-12 rounded-xl text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/20"
          size="lg"
          disabled={isLoading}
        >
          {isLoading ? "Please wait..." : (showOtp ? "Verify & Login" : (showPasswordField ? "Sign In" : "Continue"))}
        </Button>
      </form>

      {/* Divider */}
      {!showPasswordField && !showOtp && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#B85C3C]/10" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
            <span className="bg-white px-3 text-[#2C1810]/40 font-medium">Or continue with</span>
          </div>
        </div>
      )}

      {/* Google OAuth */}
      {!showPasswordField && !showOtp && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 rounded-xl gap-3 border-2 border-[#B85C3C]/10 text-[#2C1810] hover:bg-[#FAF7F2] hover:border-[#B85C3C]/20 transition-all"
          size="lg"
          onClick={onGoogleSignIn}
        >
          <FcGoogle className="h-5 w-5" />
          <span className="font-medium">Continue with Google</span>
        </Button>
      )}

      {/* Switch to Register */}
      <p className="text-center mt-6 text-sm text-[#2C1810]/60">
        Don't have an account?{" "}
        <button
          type="button"
          className="text-[#B85C3C] hover:text-[#2C1810] font-bold transition-colors"
          onClick={onSwitchToRegister}
        >
          Register here
        </button>
      </p>

      {/* Social Media Links */}
      <div className="mt-8 pt-6 border-t border-[#B85C3C]/10">
        <p className="text-center text-[10px] text-[#2C1810]/40 uppercase tracking-wider font-medium mb-3">
          Follow Us
        </p>
        <div className="flex justify-center gap-2">
          <button className="w-9 h-9 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#2C1810]/50 hover:bg-[#B85C3C] hover:text-white transition-all">
            <Facebook size={16} />
          </button>
          <button className="w-9 h-9 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#2C1810]/50 hover:bg-[#B85C3C] hover:text-white transition-all">
            <Twitter size={16} />
          </button>
          <button className="w-9 h-9 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#2C1810]/50 hover:bg-[#B85C3C] hover:text-white transition-all">
            <Instagram size={16} />
          </button>
          <button className="w-9 h-9 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#2C1810]/50 hover:bg-[#B85C3C] hover:text-white transition-all">
            <Youtube size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
