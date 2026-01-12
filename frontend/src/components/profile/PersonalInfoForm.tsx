import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PhoneInput } from "@/components/ui/phone-input";

interface PersonalInfoFormProps {
    initialData: {
        firstName: string;
        lastName?: string;
        gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
        email: string;
        phone?: string;
    };
    onSave: (data: {
        firstName: string;
        lastName?: string;
        gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
        phone?: string;
    }) => Promise<void>;
    loading?: boolean;
    onChangePassword?: () => void;
}

export default function PersonalInfoForm({
    initialData,
    onSave,
    loading = false,
    onChangePassword
}: PersonalInfoFormProps) {
    const [formData, setFormData] = useState({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        gender: initialData.gender || '',
        phone: initialData.phone || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setFormData({
            firstName: initialData.firstName || '',
            lastName: initialData.lastName || '',
            gender: initialData.gender || '',
            phone: initialData.phone || '',
        });
    }, [initialData]);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }

        if (!formData.phone || formData.phone.trim().length < 10) {
            newErrors.phone = 'Phone number is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        await onSave({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim() || undefined,
            gender: (formData.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say') || undefined,
            phone: formData.phone,
        });
    };

    const hasChanges = () => {
        return (
            formData.firstName !== (initialData.firstName || '') ||
            formData.lastName !== (initialData.lastName || '') ||
            formData.gender !== (initialData.gender || '') ||
            formData.phone !== (initialData.phone || '')
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                    Update your personal details here. Email address cannot be changed.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">
                                First Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={(e) =>
                                    setFormData({ ...formData, firstName: e.target.value })
                                }
                                autoComplete="given-name"
                                className={errors.firstName ? 'border-destructive' : ''}
                            />
                            {errors.firstName && (
                                <p className="text-sm text-destructive">{errors.firstName}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name (Optional)</Label>
                            <Input
                                id="lastName"
                                value={formData.lastName}
                                placeholder="Enter your last name"
                                onChange={(e) =>
                                    setFormData({ ...formData, lastName: e.target.value })
                                }
                                autoComplete="family-name"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            value={initialData.email}
                            disabled
                            autoComplete="email"
                            className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                            Contact support to change your email address
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Gender */}
                        <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, gender: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                    <SelectItem value="prefer_not_to_say">
                                        Prefer not to say
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="phone">
                                Mobile Number <span className="text-destructive">*</span>
                            </Label>
                            <PhoneInput
                                id="phone"
                                value={formData.phone}
                                onChange={(val) => setFormData({ ...formData, phone: val })}
                                error={errors.phone}
                                required={true}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onChangePassword}
                        >
                            Change Password
                        </Button>

                        {hasChanges() && (
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
