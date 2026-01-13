import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { CheckoutAddress, CreateAddressDto } from "@/types";
import { useLocationStore } from "@/store/locationStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getErrorMessage } from "@/lib/errorUtils";


interface AddressFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: CreateAddressDto) => Promise<void | CheckoutAddress>;
    initialData?: Partial<CheckoutAddress>;
    availableTypes: Array<'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both'>;
}

interface Country {
    country: string;
    iso2: string;
}

interface State {
    name: string;
    state_code: string;
}

export default function AddressFormModal({
    open,
    onClose,
    onSave,
    initialData,
    availableTypes
}: AddressFormModalProps) {
    const [formData, setFormData] = useState<CreateAddressDto>({
        type: 'other',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        full_name: '',
        phone: '',
        is_primary: false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // Location Store
    const {
        countries,
        states: statesMap,
        isLoadingCountries,
        isLoadingStates: loadingStatesMap,
        fetchStates,
        validatePostalCode,
        isValidatingPostalCode,
        error: locationError
    } = useLocationStore();

    const selectedCountry = countries.find(c => c.country === formData.country);
    const countryIso2 = selectedCountry?.iso2;

    const currentStates = countryIso2 ? (statesMap[countryIso2] || []) : [];
    const isStatesLoading = countryIso2 ? (loadingStatesMap[countryIso2] || false) : false;
    const [apiError, setApiError] = useState<string | null>(null);

    // Postal Code Validation Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Only validate if country is India
            if (formData.country === 'India' && formData.postal_code) {
                const result = await validatePostalCode(formData.postal_code);
                if (result && result.isValid) {
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.postal_code;
                        return newErrors;
                    });

                    // Auto-fill City and State if available and not manually set (or just overwrite)
                    // The user requested "ensure the field displays accurate city and locality results"
                    setFormData(prev => ({
                        ...prev,
                        city: result.city || prev.city,
                        state: result.state || prev.state,
                        country: result.country === 'India' ? 'India' : prev.country
                    }));

                    // If country is India, ensure states are fetched
                    if (formData.country !== 'India') { // This check might be redundant if we only enter here if country IS India, but maybe useful if we just switched? 
                        // Actually, lines above ensure we only enter if formData.country === 'India'.
                        // So we can assume it's already set.
                        fetchStates('IN');
                    }

                } else {
                    setErrors(prev => ({ ...prev, postal_code: "Invalid postal code" }));
                }
            } else {
                // If not India, clear postal code error if it exists so we don't block submission
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.postal_code;
                    return newErrors;
                });
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [formData.postal_code, formData.country, validatePostalCode]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                type: initialData.type || 'other',
                address_line1: initialData.address_line1 || '',
                address_line2: initialData.address_line2 || '',
                city: initialData.city || '',
                state: initialData.state || '',
                postal_code: initialData.postal_code || '',
                country: initialData.country || '',
                full_name: initialData.full_name || '',
                phone: initialData.phone || '',
                is_primary: initialData.is_primary || false,
            });

            if (initialData.country) {
                const countryData = countries.find(c => c.country === initialData.country);
                if (countryData) {
                    fetchStates(countryData.iso2);

                    // Normalize phone number if it's not in E.164 format
                    let phone = initialData.phone || '';
                    if (phone && !phone.startsWith('+')) {
                        // If it looks like a valid number but missing plus, prepend it
                        // Try to use country code if available
                        if (countryData.phone_code) {
                            phone = `${countryData.phone_code}${phone}`;
                        } else {
                            // Fallback to +91 if no country code found
                            phone = `+91${phone}`;
                        }
                        setFormData(prev => ({ ...prev, phone }));
                    }
                }
            }
        } else {
            setFormData({
                type: availableTypes.includes('home') ? 'home' : availableTypes.includes('work') ? 'work' : 'other',
                address_line1: '',
                address_line2: '',
                city: '',
                state: '',
                postal_code: '',
                country: '',
                full_name: '',
                phone: '',
                is_primary: false,
            });
        }
    }, [initialData, open, availableTypes, fetchStates, countries]);

    const handleCountryChange = (value: string) => {
        setFormData(prev => ({ ...prev, country: value, state: '' }));
        const country = countries.find(c => c.country === value);
        if (country) {
            fetchStates(country.iso2);
            // If phone is empty or just has old code, update it to new country code
            if (!formData.phone || formData.phone.length < 4) {
                setFormData(prev => ({ ...prev, phone: country.phone_code || '' }));
            }
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.address_line1.trim()) {
            newErrors.address_line1 = 'Street address is required';
        }

        if (!formData.city.trim()) {
            newErrors.city = 'City is required';
        }

        if (!formData.state.trim()) {
            newErrors.state = 'State is required';
        }

        if (!formData.country?.trim()) {
            newErrors.country = 'Country is required';
        }

        if (!formData.postal_code.trim()) {
            newErrors.postal_code = 'Postal code is required';
        }

        if (!formData.phone || formData.phone.trim().length < 13) {
            newErrors.phone = 'Phone number is required and must be 10 digits';
        }

        // If we have a validation error from the API check, keep it
        if (errors.postal_code) {
            newErrors.postal_code = errors.postal_code;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);
        try {
            await onSave({
                type: formData.type,
                address_line1: formData.address_line1.trim(),
                address_line2: formData.address_line2?.trim() || undefined,
                city: formData.city.trim(),
                state: formData.state.trim(),
                postal_code: formData.postal_code.trim(),
                country: formData.country,
                full_name: formData.full_name.trim(),
                phone: formData.phone.trim(),
                is_primary: formData.is_primary,
            });
            onClose();
        } catch (error: unknown) {
            setErrors({ general: getErrorMessage(error, "Failed to save address") });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-none shadow-elevated p-0">
                <div className="bg-muted/30 p-8 border-b border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-playfair text-[#2C1810]">
                            {initialData ? 'Refine Sanctuary' : 'Establish New Sanctuary'}
                        </DialogTitle>
                        <DialogDescription className="text-sm italic">
                            {initialData ? 'Update your sacred location details' : 'Define a new path for delivery'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {errors.general && (
                            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                                {errors.general}
                            </div>
                        )}

                        {(apiError || locationError) && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{apiError || locationError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Type */}
                            <div className="space-y-2">
                                <Label htmlFor="type">
                                    Address Type <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value: 'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both') =>
                                        setFormData({ ...formData, type: value })
                                    }
                                    disabled={initialData?.type !== 'other' && !!initialData}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableTypes.includes('home') && (
                                            <SelectItem value="home">Home</SelectItem>
                                        )}
                                        {availableTypes.includes('work') && (
                                            <SelectItem value="work">Work</SelectItem>
                                        )}
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {formData.type !== 'other' && !availableTypes.includes(formData.type) && initialData && (
                                    <p className="text-xs text-muted-foreground">
                                        Type cannot be changed for home/work addresses
                                    </p>
                                )}
                            </div>

                            {/* Full Name (Label) */}
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Full Name / Label</Label>
                                <Input
                                    id="full_name"
                                    value={formData.full_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, full_name: e.target.value })
                                    }
                                    placeholder="e.g., Mom's House, Office"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <Label htmlFor="phone">
                                Phone Number <span className="text-destructive">*</span>
                            </Label>
                            <PhoneInput
                                id="phone"
                                value={formData.phone}
                                onChange={(value) =>
                                    setFormData({ ...formData, phone: value as string })
                                }
                                placeholder="Enter phone number"
                                className={errors.phone ? 'border-destructive' : ''}
                            />
                            {errors.phone && (
                                <p className="text-sm text-destructive">{errors.phone}</p>
                            )}
                        </div>

                        {/* Street Address */}
                        <div className="space-y-2">
                            <Label htmlFor="address_line1">
                                Street Address <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="address_line1"
                                value={formData.address_line1}
                                onChange={(e) =>
                                    setFormData({ ...formData, address_line1: e.target.value })
                                }
                                placeholder="Enter street address"
                                className={errors.address_line1 ? 'border-destructive' : ''}
                            />
                            {errors.address_line1 && (
                                <p className="text-sm text-destructive">{errors.address_line1}</p>
                            )}
                        </div>

                        {/* Apartment */}
                        <div className="space-y-2">
                            <Label htmlFor="address_line2">Apartment, Suite, etc.</Label>
                            <Input
                                id="address_line2"
                                value={formData.address_line2 || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, address_line2: e.target.value })
                                }
                                placeholder="Optional"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Country */}
                            <div className="space-y-2">
                                <Label htmlFor="country">
                                    Country <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.country}
                                    onValueChange={handleCountryChange}
                                    disabled={isLoadingCountries}
                                >
                                    <SelectTrigger className={errors.country ? 'border-destructive' : ''}>
                                        <SelectValue placeholder={isLoadingCountries ? "Loading countries..." : "Select Country"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {countries.map((country) => (
                                            <SelectItem key={country.country} value={country.country}>
                                                {country.country} {country.phone_code ? `(${country.phone_code})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.country && (
                                    <p className="text-sm text-destructive">{errors.country}</p>
                                )}
                            </div>

                            {/* State */}
                            <div className="space-y-2">
                                <Label htmlFor="state">
                                    State <span className="text-destructive">*</span>
                                </Label>
                                {currentStates.length > 0 ? (
                                    <Select
                                        value={formData.state}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, state: value })
                                        }
                                        disabled={!formData.country || isStatesLoading}
                                    >
                                        <SelectTrigger className={errors.state ? 'border-destructive' : ''}>
                                            <SelectValue placeholder={isStatesLoading ? "Loading states..." : "Select State"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currentStates.map((state) => (
                                                <SelectItem key={state.name} value={state.name}>
                                                    {state.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        id="state"
                                        value={formData.state}
                                        onChange={(e) =>
                                            setFormData({ ...formData, state: e.target.value })
                                        }
                                        placeholder={!formData.country ? "Select country first" : "Enter state"}
                                        disabled={!formData.country}
                                        className={errors.state ? 'border-destructive' : ''}
                                    />
                                )}
                                {errors.state && (
                                    <p className="text-sm text-destructive">{errors.state}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Postal Code */}
                            <div className="space-y-2">
                                <Label htmlFor="postal_code">
                                    Postal Code <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="postal_code"
                                        value={formData.postal_code}
                                        onChange={(e) =>
                                            setFormData({ ...formData, postal_code: e.target.value })
                                        }
                                        placeholder="Enter postal code"
                                        className={errors.postal_code ? 'border-destructive pr-8' : 'pr-8'}
                                    />
                                    {isValidatingPostalCode && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                {errors.postal_code && (
                                    <p className="text-sm text-destructive">{errors.postal_code}</p>
                                )}
                            </div>

                            {/* City */}
                            <div className="space-y-2">
                                <Label htmlFor="city">
                                    City <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="city"
                                    value={formData.city}
                                    onChange={(e) =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                    placeholder="Enter city"
                                    className={errors.city ? 'border-destructive' : ''}
                                />
                                {errors.city && (
                                    <p className="text-sm text-destructive">{errors.city}</p>
                                )}
                            </div>
                        </div>

                        {/* Set as Primary */}
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_primary"
                                checked={formData.is_primary}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, is_primary: checked as boolean })
                                }
                            />
                            <Label htmlFor="is_primary" className="cursor-pointer">
                                Set as primary address
                            </Label>
                        </div>

                        <DialogFooter className="pt-6 border-t border-dashed border-border/60">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="rounded-full px-8 font-bold text-xs uppercase tracking-widest"
                            >
                                Retreat
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="rounded-full bg-[#2C1810] hover:bg-[#B85C3C] text-white px-10 font-bold text-xs uppercase tracking-widest shadow-lg transition-all"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {initialData ? 'Confirm Change' : 'Establish Path'}
                            </Button>
                        </DialogFooter>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
