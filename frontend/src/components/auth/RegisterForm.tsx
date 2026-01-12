
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

interface RegisterFormProps {
  emailOrPhone?: string;
  onSubmit: (name: string, phone: string, password: string, email: string) => void;
  onSwitchToLogin: () => void;
  onGoogleSignIn?: () => void;
}

import { validators } from "@/lib/validation";

export function RegisterForm({
  emailOrPhone: initialEmailOrPhone = "",
  onSubmit,
  onSwitchToLogin,
  onGoogleSignIn,
}: RegisterFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialEmailOrPhone);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
    const passError = validators.password(password);
    if (passError) {
      setPasswordError(passError);
      return;
    }

    if (
      name.trim() &&
      phone && phone.length > 5 // Basic check, better validation exists in PhoneInput but this enforces presence
    ) {
      // The previous code had "emailOrPhone" passed in as phone?
      // Let's add an Email field if it's missing or clarify the intent.
      // In AuthNew.tsx, 'emailOrPhone' was passed. If it was an email, we are good.
      // If it was a phone, we need an email for Supabase (by default).
      // I'll add an Email input to be safe, or rename PhoneInput to dynamic input.
      // Looking at the previous file, it had "Mobile Number" field.
      // I will add an Email field.
      onSubmit(name, phone, password, email); // This submits to AuthNew which calls registerUser
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordError(null);
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Create Account
        </h2>
        <p className="text-sm text-muted-foreground">Register to get started</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" action="#">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            required
          />
        </div>

        {/* We generally need an Email for Supabase Auth unless using Phone Auth */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required // Make it required for Supabase
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Mobile Number</Label>
          <PhoneInput
            id="phone"
            value={phone}
            onChange={(value) => setPhone(value as string)}
            placeholder="Enter your mobile number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter your password (min 8 characters)"
              required
              minLength={8}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {passwordError && (
            <p className="text-sm text-red-500 mt-1">{passwordError}</p>
          )}
        </div>

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

        <Button type="submit" className="w-full" size="lg">
          Create Account
        </Button>
      </form >

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

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

      <p className="text-center mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Button
          variant="link"
          className="px-1 text-primary"
          onClick={onSwitchToLogin}
        >
          Login here
        </Button>
      </p>
    </div >
  );
}
