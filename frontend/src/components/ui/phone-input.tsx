import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLocationStore } from "@/store/locationStore";

interface PhoneInputProps {
    value?: string;
    onChange: (value: string) => void;
    error?: string;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    id?: string;
    className?: string;
    placeholder?: string;
}

export function PhoneInput({
    value = "",
    onChange,
    error,
    label,
    required = false,
    disabled = false,
    id = "phone-input",
    className,
    placeholder
}: PhoneInputProps) {
    const { countries, fetchCountries, isInitialized } = useLocationStore();
    const [countryCode, setCountryCode] = useState("+91");
    const [phoneNumber, setPhoneNumber] = useState("");

    // Initialize store if needed
    useEffect(() => {
        if (!isInitialized) {
            fetchCountries();
        }
    }, [isInitialized, fetchCountries]);

    // Initialize state from value prop
    useEffect(() => {
        if (value) {
            if (value.startsWith("+")) {
                // Find matching country code from store or fallback
                // Sort countries by code length desc to match longest prefix first
                const matchingCountry = countries.find(c =>
                    c.phone_code && value.startsWith(c.phone_code)
                );

                if (matchingCountry?.phone_code) {
                    setCountryCode(matchingCountry.phone_code);
                    setPhoneNumber(value.slice(matchingCountry.phone_code.length).trim());
                } else {
                    // Fallback for common codes if store not ready or custom
                    const codes = ["+91", "+1", "+44", "+61", "+81", "+86", "+971"];
                    const foundCode = codes.find((c) => value.startsWith(c));
                    if (foundCode) {
                        setCountryCode(foundCode);
                        setPhoneNumber(value.slice(foundCode.length).trim());
                    } else {
                        setPhoneNumber(value);
                    }
                }
            } else {
                setPhoneNumber(value);
            }
        } else {
            setPhoneNumber("");
        }
    }, [value, countries]);

    const handleCodeChange = (code: string) => {
        setCountryCode(code);
        if (phoneNumber) {
            onChange(`${code} ${phoneNumber}`);
        } else {
            if (phoneNumber) onChange(`${code} ${phoneNumber}`);
        }
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, "");
        if (val.length <= 10) {
            setPhoneNumber(val);
            onChange(val ? `${countryCode} ${val}` : "");
        }
    };

    // Filter countries with phone codes and sort by priority/name
    const sortedCountries = countries
        .filter(c => c.phone_code)
        .sort((a, b) => {
            // Put India first, then US, then others
            if (a.country === 'India') return -1;
            if (b.country === 'India') return 1;
            if (a.country === 'United States') return -1;
            if (b.country === 'United States') return 1;
            return a.country.localeCompare(b.country);
        });

    // Deduplicate by phone code to prevent "duplicate key" errors in Select
    // We prefer the first occurrence (which respects our sort order)
    const uniqueCountryOptions = sortedCountries.filter((c, index, self) =>
        index === self.findIndex((t) => (
            t.phone_code === c.phone_code
        ))
    );

    return (
        <div className="space-y-2">
            {label && (
                <Label htmlFor={id}>
                    {label} {required && <span className="text-destructive">*</span>}
                </Label>
            )}
            <div className="flex gap-2">
                <Select
                    value={countryCode}
                    onValueChange={handleCodeChange}
                    disabled={disabled}
                >
                    <SelectTrigger className="w-[120px]" type="button">
                        <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                        {uniqueCountryOptions.length > 0 ? (
                            uniqueCountryOptions.map((c) => (
                                <SelectItem key={`${c.iso2}-${c.phone_code}`} value={c.phone_code || ""}>
                                    {c.iso2} ({c.phone_code})
                                </SelectItem>
                            ))
                        ) : (
                            // Fallback options while loading
                            <>
                                <SelectItem value="+91">IN (+91)</SelectItem>
                                <SelectItem value="+1">US (+1)</SelectItem>
                            </>
                        )}
                    </SelectContent>
                </Select>
                <Input
                    id={id}
                    type="tel"
                    value={phoneNumber}
                    onChange={handleNumberChange}
                    placeholder={placeholder || "Mobile number"}
                    disabled={disabled}
                    className={cn("flex-1", error ? "border-destructive" : "", className)}
                />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}
