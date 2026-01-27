import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  requestPasswordReset,
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
  const { t } = useTranslation();
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

  // Auto-hide general errors after 5 seconds
  useEffect(() => {
    if (fieldErrors.general) {
      const timer = setTimeout(() => {
        setFieldErrors((prev) => {
          const { general, ...rest } = prev;
          return rest;
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fieldErrors.general]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (showOtp) {
        // Step 2: Verify OTP
        if (!formData.otp || formData.otp.length < 6) {
          toast.error(t("auth.invalidOtpToast"));
          setIsLoading(false);
          return;
        }

        const user = await verifyLoginOtp(formData.email, formData.otp);

        login(user);
        toast.success(t("auth.loginSuccessToast"));
        onOpenChange(false);
        setShowOtp(false); // Reset for next time

        const returnUrl = sessionStorage.getItem("authReturnUrl");
        if (returnUrl) {
          sessionStorage.removeItem("authReturnUrl");
          navigate(returnUrl);
        } else if (user.role === "admin") {
          navigate("/admin");
        } else if (user.role === "manager") {
          navigate("/manager");
        } else {
          navigate("/");
        }
      } else {
        // Step 1: Validate Credentials
        const res = await validateCredentials(formData.email, formData.password);
        if (res.success) {
          toast.success(t("auth.otpSentToast"));
          setShowOtp(true);
          setFieldErrors({}); // Clear errors when moving to OTP step
        } else {
          // Pass the error to the catch block to be handled by getErrorDetails/getErrorMessage
          throw new Error(res.error || t("auth.validationFailed"));
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
        setFieldErrors({ general: getErrorMessage(error, t("auth.loginFailed")) });
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
      setFieldErrors(prev => ({ ...prev, phone: t("auth.phoneRequiredToast") }));
      setIsLoading(false);
      return;
    }

    // Validate password
    const passwordErrors: string[] = [];
    if (formData.password.length < 8) {
      passwordErrors.push(t("auth.passwordLength"));
    }
    if (!/[A-Z]/.test(formData.password)) {
      passwordErrors.push(t("auth.passwordUppercase"));
    }
    if (!/[a-z]/.test(formData.password)) {
      passwordErrors.push(t("auth.passwordLowercase"));
    }
    if (!/[0-9]/.test(formData.password)) {
      passwordErrors.push(t("auth.passwordNumber"));
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      passwordErrors.push(t("auth.passwordSpecial"));
    }

    if (passwordErrors.length > 0) {
      setFieldErrors(prev => ({ ...prev, password: passwordErrors.join("\n") }));
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
      toast.success(t("auth.accountCreatedToast"));

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
        const errorMsg = getErrorMessage(error, t("auth.registrationFailed"));
        if (errorMsg.includes("already registered")) {
          toast.error(t("auth.accountExistsToast"));
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
      await requestPasswordReset(formData.email);
      toast.success(t("auth.resetEmailSentToast"));
      setStep("login");
    } catch (error: unknown) {
      setFieldErrors({ general: getErrorMessage(error, t("auth.resetFailed")) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("auth.googleLoginFailed")));
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
        toast.success(t("auth.otpSentToast"));
        setResendCooldown(30);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("auth.otpFailed")));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      await resendConfirmationEmail(formData.email);
      toast.success(t("auth.otpSentToast")); // Re-using OTP sent toast for email confirmation too
      setResendCooldown(30);
    } catch (error: unknown) {
      const msg = getErrorMessage(error, t("auth.confirmationFailed"));
      toast.error(msg);
      if (msg.toLowerCase().includes("already verified")) {
        setStep("login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (step) {
      case "register": return t("auth.createAccountTitle");
      case "forgot-password": return t("auth.resetPasswordTitle");
      case "success": return t("auth.regSuccessTitle");
      default: return t("auth.welcomeBack");
    }
  };

  const getDescription = () => {
    switch (step) {
      case "register": return t("auth.signUpSubtitle");
      case "forgot-password": return t("auth.resetSubtitle");
      case "success": return t("auth.regSuccessSubtitle");
      default: return t("auth.journeySubtitle");
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
                  {t("auth.googleContinue")}
                </Button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t("auth.orContinueWithEmail")}
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
                      <Label htmlFor="email">{t("auth.emailLabel")}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("auth.emailPlaceholder")}
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
                      <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder={t("auth.passwordPlaceholder")}
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
                        {t("auth.forgotPassword")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="text-center">
                      <h3 className="text-lg font-medium">{t("auth.verificationRequired")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("auth.enterOtpSentTo")} {formData.email}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="otp">{t("auth.otpLabel")}</Label>
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
                        {resendCooldown > 0 ? `${t("auth.resendAvailableIn")} ${resendCooldown}s` : t("auth.resendOtp")}
                      </Button>
                      <div>
                        <Button
                          variant="link"
                          type="button"
                          className="text-sm"
                          onClick={() => setShowOtp(false)}
                        >
                          {t("auth.changeEmailPassword")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {showOtp ? t("auth.verifying") : t("auth.signIn")}
                    </>
                  ) : (
                    showOtp ? t("auth.verifyLogin") : t("auth.next")
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">
                    {t("auth.dontHaveAccount")}{" "}
                  </span>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => setStep("register")}
                    type="button"
                  >
                    {t("auth.signUp")}
                  </Button>
                </div>
              </form>
            )}

            {step === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4" action="#">
                <div>
                  <Label htmlFor="reg-name">{t("profile.personalInfo.firstName")} / {t("profile.personalInfo.lastName")}</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder={t("auth.namePlaceholder")}
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
                  <Label htmlFor="reg-email">{t("auth.emailLabel")}</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder={t("auth.emailPlaceholder")}
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
                  <Label htmlFor="reg-phone">{t("profile.phone")} <span className="text-destructive">*</span></Label>
                  <PhoneInput
                    id="reg-phone"
                    placeholder={t("profile.address.phonePlaceholder")}
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
                  <Label htmlFor="reg-password">{t("auth.passwordLabel")}</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder={t("auth.createPasswordPlaceholder")}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (fieldErrors.password || fieldErrors.general) {
                          setFieldErrors(prev => ({ ...prev, password: "", general: "" }));
                        }
                      }}
                      required
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
                    <p className="text-xs text-destructive mt-1 whitespace-pre-line leading-relaxed font-medium transition-all duration-200 animate-in slide-in-from-top-1">{fieldErrors.password}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth.creatingAccount")}
                    </>
                  ) : (
                    t("auth.createAccountTitle")
                  )}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">
                    {t("auth.alreadyHaveAccount")}{" "}
                  </span>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => setStep("login")}
                    type="button"
                  >
                    {t("auth.signIn")}
                  </Button>
                </div>
              </form>
            )}

            {step === "forgot-password" && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" action="#">
                <div>
                  <Label htmlFor="reset-email">{t("auth.emailLabel")}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={t("auth.emailPlaceholder")}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (fieldErrors.general) {
                        setFieldErrors({});
                      }
                    }}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth.sending")}
                    </>
                  ) : (
                    t("auth.sendResetLink")
                  )}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("login")}
                  type="button"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("auth.backToLogin")}
                </Button>
              </form>
            )}

            {step === "success" && (
              <div className="space-y-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("auth.regSuccessEmailSent")}
                  <br />
                  {t("auth.regSuccessInstruction")}
                </p>
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => setStep("login")}>
                    {t("auth.proceedToLogin")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={handleResendConfirmation}
                    disabled={isLoading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `${t("auth.resendAvailableIn")} ${resendCooldown}s` : t("auth.resendConfirmationEmail")}
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
