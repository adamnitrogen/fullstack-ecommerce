import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useNavigate } from "react-router-dom";
import {
  registerUser,
  loginWithGoogle,
  resetPassword,
  validateCredentials,
  verifyLoginOtp,
  resendConfirmationEmail
} from "@/lib/services/auth.service";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types";
import { getErrorMessage, getErrorDetails } from "@/lib/errorUtils";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

type AuthStep = "login" | "register" | "forgot-password" | "success";

interface AuthPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStep?: "login" | "register";
}

export default function AuthPage({
  open,
  onOpenChange,
  defaultStep = "login",
}: AuthPageProps) {
  const initialStep = defaultStep.includes("register") ? "register" : "login";

  const [step, setStep] = useState<AuthStep>(initialStep);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    otp: "" // Added OTP
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showOtp, setShowOtp] = useState(false); // Added OTP state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setFormData({ email: "", password: "", name: "", phone: "", otp: "" });
      setFieldErrors({});
      setShowOtp(false); // Reset OTP screen state
    }
  }, [open, initialStep]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (showOtp) {
        // Step 2: Verify OTP
        if (!formData.otp || formData.otp.length < 6) {
          toast.error("Please enter a valid OTP");
          setIsLoading(false);
          return;
        }

        const user = await verifyLoginOtp(formData.email, formData.otp);

        login(user);
        toast.success("Login successful!");
        onOpenChange(false);
        setShowOtp(false); // Reset for next time

        const returnUrl = sessionStorage.getItem("authReturnUrl");
        if (returnUrl) {
          sessionStorage.removeItem("authReturnUrl");
          navigate(returnUrl);
        } else if (user.role === "admin" || user.role === "manager") {
          navigate("/admin");
        } else {
          navigate("/");
        }
      } else {
        // Step 1: Validate Credentials
        const res = await validateCredentials(formData.email, formData.password);
        if (res.success) {
          toast.success("Credentials valid. OTP sent to your email.");
          setShowOtp(true);
          setFieldErrors({}); // Clear errors when moving to OTP step
        }
      }
    } catch (error: unknown) {
      logger.error("Login error:", error);
      const details = getErrorDetails(error);

      if (details) {
        const errors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          errors[field] = d.message;
        });
        setFieldErrors(errors);
      } else {
        setFieldErrors({ general: getErrorMessage(error, "Login failed") });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFieldErrors({});

    // Validate phone
    if (!formData.phone || formData.phone.length < 10) {
      setFieldErrors(prev => ({ ...prev, phone: "Please enter a valid phone number" }));
      setIsLoading(false);
      return;
    }

    try {
      await registerUser({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
      });

      setStep("success");
      toast.success("Account created successfully!");

    } catch (error: unknown) {
      logger.error("Registration error:", error);
      const details = getErrorDetails(error);

      if (details) {
        const errors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          errors[field] = d.message;
        });
        setFieldErrors(errors);
      } else {
        const errorMsg = getErrorMessage(error, "Registration failed");
        if (errorMsg.includes("already registered")) {
          toast.error("Account already exists. Please log in.");
          setStep("login");
        } else {
          setFieldErrors({ general: errorMsg });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await resetPassword(formData.email);
      toast.success("Password reset email sent! Check your inbox.");
      setStep("login");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to send reset email"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Google login failed"));
    }
  };

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      const res = await validateCredentials(formData.email, formData.password);
      if (res.success) {
        toast.success("OTP resent successfully.");
        setResendCooldown(30);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to resend OTP"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      await resendConfirmationEmail(formData.email);
      toast.success("Confirmation email resent!");
      setResendCooldown(30);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to resend email"));
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (step) {
      case "register": return "Create Account";
      case "forgot-password": return "Reset Password";
      case "success": return "Registration Successful!";
      default: return "Welcome Back";
    }
  };

  const getDescription = () => {
    switch (step) {
      case "register": return "Sign up to get started";
      case "forgot-password": return "Enter your email to receive reset instructions";
      case "success": return "Your account has been created successfully.";
      default: return "Sign in to your account";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-2xl font-bold text-center">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-center">
            {getDescription()}
          </DialogDescription>

          <div className="mt-6">
            {step !== "forgot-password" && step !== "success" && (
              <>
                <Button
                  variant="outline"
                  className="w-full mb-4 flex items-center gap-2"
                  onClick={handleGoogleLogin}
                  type="button"
                >
                  <FcGoogle className="w-5 h-5" />
                  Continue with Google
                </Button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>
              </>
            )}

            {fieldErrors.general && (
              <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
                {fieldErrors.general}
              </div>
            )}

            {step === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4" action="#">
                {!showOtp ? (
                  <>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          if (fieldErrors.email || fieldErrors.general) {
                            setFieldErrors(prev => ({ ...prev, email: "", general: "" }));
                          }
                        }}
                        required
                        autoComplete="email"
                        className={fieldErrors.email ? "border-destructive" : ""}
                      />
                      {fieldErrors.email && (
                        <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                            if (fieldErrors.password || fieldErrors.general) {
                              setFieldErrors(prev => ({ ...prev, password: "", general: "" }));
                            }
                          }}
                          required
                          autoComplete="current-password"
                          className={`pr-10 ${fieldErrors.password ? "border-destructive" : ""}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="link"
                        className="p-0 h-auto text-sm"
                        onClick={() => setStep("forgot-password")}
                        type="button"
                      >
                        Forgot password?
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="text-center">
                      <h3 className="text-lg font-medium">Verification Required</h3>
                      <p className="text-sm text-muted-foreground">
                        Enter the OTP sent to {formData.email}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="otp">One-Time Password</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="123456"
                        value={formData.otp || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormData({ ...formData, otp: val });
                          if (fieldErrors.otp || fieldErrors.general) {
                            setFieldErrors(prev => ({ ...prev, otp: "", general: "" }));
                          }
                        }}
                        required
                        maxLength={6}
                        autoComplete="one-time-code"
                        className="text-center text-2xl tracking-widest"
                        autoFocus
                      />
                    </div>
                    <div className="text-center pt-2 space-y-2">
                      <Button
                        variant="ghost"
                        type="button"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={handleResendOtp}
                        disabled={isLoading || resendCooldown > 0}
                      >
                        {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                      </Button>
                      <div>
                        <Button
                          variant="link"
                          type="button"
                          className="text-sm"
                          onClick={() => setShowOtp(false)}
                        >
                          Change Email / Password
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {showOtp ? "Verifying..." : "Sign In"}
                    </>
                  ) : (
                    showOtp ? "Verify Login" : "Next"
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">
                    Don't have an account?{" "}
                  </span>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => setStep("register")}
                    type="button"
                  >
                    Sign up
                  </Button>
                </div>
              </form>
            )}

            {step === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4" action="#">
                <div>
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (fieldErrors.name || fieldErrors.general) {
                        setFieldErrors(prev => ({ ...prev, name: "", general: "" }));
                      }
                    }}
                    required
                    autoComplete="name"
                    className={fieldErrors.name ? "border-destructive" : ""}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-email">Email Address</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.email || fieldErrors.general) {
                        setFieldErrors(prev => ({ ...prev, email: "", general: "" }));
                      }
                    }}
                    required
                    className={fieldErrors.email ? "border-destructive" : ""}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-phone">Phone Number <span className="text-destructive">*</span></Label>
                  <PhoneInput
                    id="reg-phone"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(value) => {
                      setFormData({ ...formData, phone: value as string });
                      if (fieldErrors.phone || fieldErrors.general) {
                        setFieldErrors(prev => ({ ...prev, phone: "", general: "" }));
                      }
                    }}
                    required={true}
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="Create a password (min 8 characters)"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (fieldErrors.password || fieldErrors.general) {
                          setFieldErrors(prev => ({ ...prev, password: "", general: "" }));
                        }
                      }}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className={`pr-10 ${fieldErrors.password ? "border-destructive" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">
                    Already have an account?{" "}
                  </span>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => setStep("login")}
                    type="button"
                  >
                    Sign in
                  </Button>
                </div>
              </form>
            )}

            {step === "forgot-password" && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" action="#">
                <div>
                  <Label htmlFor="reset-email">Email Address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("login")}
                  type="button"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </form>
            )}

            {step === "success" && (
              <div className="space-y-6 text-center">
                <p className="text-sm text-muted-foreground">
                  We have sent a confirmation email to your inbox.
                  Please verify your email, then log in to continue.
                </p>
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => setStep("login")}>
                    Proceed to Login
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleResendConfirmation}
                    disabled={isLoading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend Confirmation Email"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
