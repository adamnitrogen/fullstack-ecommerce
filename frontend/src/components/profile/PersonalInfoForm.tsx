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
import { Loader2, User, Mail, Phone, Shield, Lock, ChevronRight, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { PhoneInput } from "@/components/ui/phone-input";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
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
            newErrors.firstName = t("errors.inventory.titleRequired"); // Or a more specific key if exists
        }

        if (!formData.phone || formData.phone.trim().length < 10) {
            newErrors.phone = t("errors.auth.invalidEmailPhone");
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
        <Card className="rounded-[2rem] border-none shadow-elevated overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 pb-8">
                <div className="flex items-center gap-3 text-[#2C1810]">
                    <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                        <User className="h-5 w-5 text-[#B85C3C]" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-playfair">{t("profile.personalInfo.title")}</CardTitle>
                        <CardDescription>{t("profile.personalInfo.subtitle")}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-8 px-6 md:px-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <UserCircle className="h-3.5 w-3.5" /> {t("profile.personalInfo.firstName")} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={(e) =>
                                    setFormData({ ...formData, firstName: e.target.value })
                                }
                                autoComplete="given-name"
                                className={`rounded-xl border-border/60 bg-white/80 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C] h-11 ${errors.firstName ? 'border-red-400' : ''}`}
                            />
                            {errors.firstName && (
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">{errors.firstName}</p>
                            )}
                        </div>
                        <div className="space-y-2.5">
                            <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <UserCircle className="h-3.5 w-3.5" /> {t("profile.personalInfo.lastName")}
                            </Label>
                            <Input
                                id="lastName"
                                value={formData.lastName}
                                placeholder={t("profile.personalInfo.lastNamePlaceholder")}
                                onChange={(e) =>
                                    setFormData({ ...formData, lastName: e.target.value })
                                }
                                autoComplete="family-name"
                                className="rounded-xl border-border/60 bg-white/80 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C] h-11"
                            />
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5" /> {t("profile.personalInfo.email")}
                        </Label>
                        <div className="relative">
                            <Input
                                id="email"
                                value={initialData.email}
                                disabled
                                autoComplete="email"
                                className="rounded-xl border-border/40 bg-muted/20 h-11 pr-10 cursor-not-allowed opacity-70"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Shield className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 ml-1 italic">
                            <Shield className="h-3 w-3" /> {t("profile.personalInfo.emailNotice")}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Gender */}
                        <div className="space-y-2.5">
                            <Label htmlFor="gender" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <ChevronRight className="h-3.5 w-3.5" /> {t("profile.personalInfo.gender")}
                            </Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, gender: value })
                                }
                            >
                                <SelectTrigger className="rounded-xl border-border/60 bg-white/80 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C] h-11">
                                    <SelectValue placeholder={t("profile.personalInfo.selectGender")} />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-elevated">
                                    <SelectItem value="male">{t("profile.personalInfo.male")}</SelectItem>
                                    <SelectItem value="female">{t("profile.personalInfo.female")}</SelectItem>
                                    <SelectItem value="other">{t("profile.personalInfo.other")}</SelectItem>
                                    <SelectItem value="prefer_not_to_say">
                                        {t("profile.personalInfo.preferNotToSay")}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2.5">
                            <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5" /> {t("profile.personalInfo.mobile")} <span className="text-red-500">*</span>
                            </Label>
                            <PhoneInput
                                id="phone"
                                value={formData.phone}
                                onChange={(val) => setFormData({ ...formData, phone: val })}
                                error={errors.phone}
                                required={true}
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-dashed border-border/60">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onChangePassword}
                            className="w-full sm:w-auto text-[#B85C3C] hover:bg-[#B85C3C]/10 rounded-full font-bold text-xs uppercase tracking-widest px-6"
                        >
                            <Lock className="h-3.5 w-3.5 mr-2" /> {t("profile.personalInfo.changePassword")}
                        </Button>

                        {hasChanges() && (
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full sm:w-auto bg-[#2C1810] hover:bg-[#B85C3C] text-white rounded-full font-bold text-xs uppercase tracking-widest px-10 h-11 shadow-lg shadow-black/10 transition-all active:scale-95"
                            >
                                {loading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ChevronRight className="mr-1 h-4 w-4" />
                                )}
                                {loading ? t("profile.personalInfo.saving") : t("profile.personalInfo.saveInfo")}
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
