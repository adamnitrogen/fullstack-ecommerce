import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { validateResetToken, resetPasswordWithToken } from '@/lib/services/auth.service';
import { getErrorMessage } from '@/lib/errorUtils';
import { toast } from '@/hooks/use-toast';

// Password validation regex (same as backend)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

interface PasswordRequirement {
    label: string;
    test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'One number', test: (p) => /\d/.test(p) },
    { label: 'One special character (@$!%*?&)', test: (p) => /[@$!%*?&]/.test(p) },
];

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success' | 'submitting'>('loading');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setStatus('invalid');
            setMessage('Invalid reset link. No token provided.');
            return;
        }

        const checkToken = async () => {
            try {
                const result = await validateResetToken(token);
                if (result.valid) {
                    setStatus('valid');
                    setEmail(result.email);
                } else {
                    setStatus('invalid');
                    setMessage('Invalid or expired reset link.');
                }
            } catch (error: unknown) {
                setStatus('invalid');
                setMessage(getErrorMessage(error, 'Invalid or expired reset link.'));
            }
        };

        checkToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!PASSWORD_REGEX.test(password)) {
            toast({
                title: 'Invalid Password',
                description: 'Please ensure your password meets all requirements.',
                variant: 'destructive',
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: 'Passwords Do Not Match',
                description: 'Please ensure both passwords are the same.',
                variant: 'destructive',
            });
            return;
        }

        setStatus('submitting');

        try {
            const result = await resetPasswordWithToken(token!, password);
            if (result.success) {
                setStatus('success');
                setMessage(result.message);
                toast({
                    title: 'Password Reset Successful',
                    description: 'You can now log in with your new password.',
                });
            }
        } catch (error: unknown) {
            setStatus('valid'); // Allow retry
            toast({
                title: 'Reset Failed',
                description: getErrorMessage(error, 'Failed to reset password. Please try again.'),
                variant: 'destructive',
            });
        }
    };

    const handleGoToLogin = () => {
        navigate('/', { state: { openAuth: true } });
    };

    const isPasswordValid = PASSWORD_REGEX.test(password);
    const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        {status === 'loading' && (
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        )}
                        {status === 'valid' && (
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <KeyRound className="w-8 h-8 text-primary" />
                            </div>
                        )}
                        {status === 'submitting' && (
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                        )}
                        {status === 'invalid' && (
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="w-8 h-8 text-red-600" />
                            </div>
                        )}
                    </div>
                    <CardTitle className="text-2xl">
                        {status === 'loading' && 'Verifying Link...'}
                        {(status === 'valid' || status === 'submitting') && 'Reset Password'}
                        {status === 'success' && 'Password Reset!'}
                        {status === 'invalid' && 'Link Invalid'}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                        {status === 'loading' && 'Please wait while we verify your reset link...'}
                        {(status === 'valid' || status === 'submitting') && `Enter a new password for ${email}`}
                        {status === 'success' && message}
                        {status === 'invalid' && message}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {(status === 'valid' || status === 'submitting') && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        required
                                        disabled={status === 'submitting'}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>

                                {/* Password Requirements */}
                                <div className="mt-2 space-y-1">
                                    {passwordRequirements.map((req, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center gap-2 text-xs ${password.length === 0
                                                    ? 'text-muted-foreground'
                                                    : req.test(password)
                                                        ? 'text-green-600'
                                                        : 'text-red-500'
                                                }`}
                                        >
                                            {password.length > 0 && (
                                                req.test(password) ? (
                                                    <CheckCircle className="w-3 h-3" />
                                                ) : (
                                                    <XCircle className="w-3 h-3" />
                                                )
                                            )}
                                            <span>{req.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        required
                                        disabled={status === 'submitting'}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                                {confirmPassword.length > 0 && (
                                    <p className={`text-xs ${doPasswordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                                        {doPasswordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                                    </p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={status === 'submitting' || !isPasswordValid || !doPasswordsMatch}
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting Password...
                                    </>
                                ) : (
                                    'Reset Password'
                                )}
                            </Button>
                        </form>
                    )}

                    {status === 'success' && (
                        <Button onClick={handleGoToLogin} className="w-full">
                            Continue to Login
                        </Button>
                    )}

                    {status === 'invalid' && (
                        <div className="space-y-3">
                            <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                                Go to Homepage
                            </Button>
                            <p className="text-sm text-center text-muted-foreground">
                                Need a new reset link? Use "Forgot Password" from the login page.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
