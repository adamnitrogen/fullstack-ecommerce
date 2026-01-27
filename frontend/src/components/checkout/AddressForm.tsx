import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { CheckoutAddress, CreateAddressDto } from "@/types";

interface AddressFormProps {
    address?: CheckoutAddress;
    onSubmit: (data: CreateAddressDto) => void;
    onCancel: () => void;
    loading?: boolean;
}

export function AddressForm({ address, onSubmit, onCancel, loading }: AddressFormProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<CreateAddressDto>({
        type: (address?.type === 'shipping' || address?.type === 'billing' || address?.type === 'both' ? address.type : 'shipping') as 'shipping' | 'billing' | 'both',
        full_name: address?.full_name || '',
        phone: address?.phone || '',
        address_line1: address?.address_line1 || '',
        address_line2: address?.address_line2 || '',
        city: address?.city || '',
        state: address?.state || '',
        postal_code: address?.postal_code || '',
        country: address?.country || 'India',
        is_primary: address?.is_primary || false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="type">{t("donate.addressForm.addressType")}</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(value: 'shipping' | 'billing' | 'both') => setFormData({ ...formData, type: value })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="shipping">{t("donate.addressForm.shipping")}</SelectItem>
                            <SelectItem value="billing">{t("donate.addressForm.billing")}</SelectItem>
                            <SelectItem value="both">{t("donate.addressForm.both")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="full_name">{t("donate.addressForm.fullName")} *</Label>
                    <Input
                        id="full_name"
                        required
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        autoComplete="name"
                    />
                </div>

                <div>
                    <Label htmlFor="phone">{t("donate.addressForm.phone")} *</Label>
                    <Input
                        id="phone"
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        autoComplete="tel"
                    />
                </div>

                <div className="md:col-span-2">
                    <Label htmlFor="address_line1">{t("donate.addressForm.addressLine1")} *</Label>
                    <Input
                        id="address_line1"
                        required
                        value={formData.address_line1}
                        onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                        autoComplete="address-line1"
                    />
                </div>

                <div className="md:col-span-2">
                    <Label htmlFor="address_line2">{t("donate.addressForm.addressLine2")}</Label>
                    <Input
                        id="address_line2"
                        value={formData.address_line2}
                        onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                        autoComplete="address-line2"
                    />
                </div>

                <div>
                    <Label htmlFor="city">{t("donate.addressForm.city")} *</Label>
                    <Input
                        id="city"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        autoComplete="address-level2"
                    />
                </div>

                <div>
                    <Label htmlFor="state">{t("donate.addressForm.state")} *</Label>
                    <Input
                        id="state"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        autoComplete="address-level1"
                    />
                </div>

                <div>
                    <Label htmlFor="postal_code">{t("donate.addressForm.postalCode")} *</Label>
                    <Input
                        id="postal_code"
                        required
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        autoComplete="postal-code"
                    />
                </div>

                <div>
                    <Label htmlFor="country">{t("donate.addressForm.country")}</Label>
                    <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        autoComplete="country-name"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <Checkbox
                    id="is_primary"
                    checked={formData.is_primary}
                    onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_primary: checked as boolean })
                    }
                />
                <Label htmlFor="is_primary" className="cursor-pointer">
                    {t("donate.addressForm.setPrimary")}
                </Label>
            </div>

            <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? t("donate.addressForm.saving") : address ? t("donate.addressForm.updateAddress") : t("donate.addressForm.addAddress")}
                </Button>
            </div>
        </form>
    );
}
