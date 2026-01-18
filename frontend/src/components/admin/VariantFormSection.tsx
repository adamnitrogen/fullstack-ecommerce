import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, GripVertical, ImageIcon, Check, Upload, X } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VariantFormData, VariantUnit } from "@/types";

interface VariantFormSectionProps {
    variants: VariantFormData[];
    onChange: (variants: VariantFormData[]) => void;
    disabled?: boolean;
    mode?: "UNIT" | "SIZE";
    onVariantImageRemoved?: (url: string) => void;
}

const UNIT_OPTIONS: { value: VariantUnit; label: string }[] = [
    { value: "kg", label: "Kilogram (KG)" },
    { value: "gm", label: "Gram (GM)" },
    { value: "ltr", label: "Litre (LTR)" },
    { value: "ml", label: "Millilitre (ML)" },
    { value: "pcs", label: "Pieces (PCS)" },
];

const SIZE_PRESETS: { value: number; unit: VariantUnit; label: string }[] = [
    { value: 0.25, unit: "kg", label: "250 GM" },
    { value: 0.5, unit: "kg", label: "500 GM" },
    { value: 1, unit: "kg", label: "1 KG" },
    { value: 2, unit: "kg", label: "2 KG" },
    { value: 3, unit: "kg", label: "3 KG" },
    { value: 5, unit: "kg", label: "5 KG" },
];

const GST_RATES = [0, 5, 12, 18, 28];

const SIZE_LABELS_PRESETS = ["Small", "Medium", "Large", "XL", "XXL", "Pack of 2", "Pack of 5"];

const createEmptyVariant = (mode: "UNIT" | "SIZE" = "UNIT"): VariantFormData => ({
    size_label: mode === "SIZE" ? "Small" : "",
    size_value: 1,
    unit: "kg",
    description: "",
    mrp: 0,
    selling_price: 0,
    stock_quantity: 0,
    is_default: false,
    hsn_code: "",
    gst_rate: 0,
    tax_applicable: true,
    price_includes_tax: true,
});

export function VariantFormSection({
    variants,
    onChange,
    disabled = false,
    mode = "UNIT",
    onVariantImageRemoved,
}: VariantFormSectionProps) {
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleAddVariant = () => {
        const newVariant = createEmptyVariant(mode);
        // If this is the first variant, make it default
        if (variants.length === 0) {
            newVariant.is_default = true;
        }
        const updated = [...variants, newVariant];
        onChange(updated);
    };

    const handleRemoveVariant = (index: number) => {
        const updated = variants.filter((_, i) => i !== index);
        // If we removed the default variant, make the first one default
        if (variants[index].is_default && updated.length > 0) {
            updated[0].is_default = true;
        }
        onChange(updated);
    };

    const handleVariantChange = (
        index: number,
        field: keyof VariantFormData,
        value: string | number | boolean | File | null
    ) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], [field]: value };

        // Auto-generate size_label when size_value or unit changes (ONLY IF MODE IS UNIT)
        if (mode === 'UNIT' && (field === "size_value" || field === "unit")) {
            const sizeValue = field === "size_value" ? value : updated[index].size_value;
            const unit = field === "unit" ? value : updated[index].unit;
            updated[index].size_label = formatSizeLabel(Number(sizeValue), unit as VariantUnit);
        }

        onChange(updated);
    };

    const handleImageUpload = (index: number, file: File) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], imageFile: file };
        onChange(updated);
    };

    const handleRemoveImage = (index: number) => {
        const updated = [...variants];
        const removedUrl = updated[index].variant_image_url;

        updated[index] = {
            ...updated[index],
            imageFile: undefined,
            variant_image_url: null
        };

        onChange(updated);

        // Notify parent about removal if it was a stored URL
        if (removedUrl && typeof removedUrl === 'string' && !removedUrl.startsWith('blob:') && onVariantImageRemoved) {
            onVariantImageRemoved(removedUrl);
        }
    };

    const handleSetDefault = (index: number) => {
        const updated = variants.map((v, i) => ({
            ...v,
            is_default: i === index,
        }));
        onChange(updated);
    };

    const handlePresetSelect = (index: number, preset: typeof SIZE_PRESETS[0]) => {
        const updated = [...variants];
        updated[index] = {
            ...updated[index],
            size_value: preset.value,
            unit: preset.unit,
            size_label: preset.label,
        };
        onChange(updated);
    };

    const formatSizeLabel = (value: number, unit: VariantUnit): string => {
        if (unit === "kg" && value < 1) {
            return `${value * 1000} GM`;
        }
        if (unit === "ltr" && value < 1) {
            return `${value * 1000} ML`;
        }
        return `${value} ${unit.toUpperCase()}`;
    };

    const getDiscountPercent = (mrp: number, sellingPrice: number): number => {
        if (mrp <= 0 || sellingPrice >= mrp) return 0;
        return Math.round(((mrp - sellingPrice) / mrp) * 100);
    };

    const isPriceValid = (variant: VariantFormData): boolean => {
        return variant.selling_price <= variant.mrp;
    };

    // State to force re-render when URLs change/load
    const [, setUrlTrigger] = useState(0);

    // Ref to track active object URLs for variant images
    // Map<File, string>
    const activeUrlsRef = useRef<Map<File, string>>(new Map());

    // Effect to manage object URLs lifecycle
    useEffect(() => {
        const filesInUse = new Set<File>();
        let changed = false;

        // 1. Identify files currently in use
        variants.forEach(v => {
            if (v.imageFile instanceof File) {
                filesInUse.add(v.imageFile);
                if (!activeUrlsRef.current.has(v.imageFile)) {
                    const url = URL.createObjectURL(v.imageFile);
                    activeUrlsRef.current.set(v.imageFile, url);
                    changed = true;
                }
            }
        });

        // 2. Revoke URLs for files no longer in use
        for (const [file, url] of activeUrlsRef.current.entries()) {
            if (!filesInUse.has(file)) {
                URL.revokeObjectURL(url);
                activeUrlsRef.current.delete(file);
                changed = true;
            }
        }

        if (changed) {
            setUrlTrigger(prev => prev + 1);
        }

    }, [variants]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            for (const url of activeUrlsRef.current.values()) {
                URL.revokeObjectURL(url);
            }
            activeUrlsRef.current.clear();
        };
    }, []);

    const getImagePreview = (variant: VariantFormData): string | null => {
        if (variant.imageFile instanceof File) {
            return activeUrlsRef.current.get(variant.imageFile) || null;
        }
        if (variant.variant_image_url) {
            return variant.variant_image_url;
        }
        return null;
    };

    return (
        <div className="space-y-4">
            {/* Variant Cards */}
            {variants.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                    <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mb-4">
                        {mode === 'SIZE' ? 'No size variants added yet (e.g., Small, Medium)' : 'No unit variants added yet (e.g., 1 KG, 500 GM)'}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddVariant}
                        disabled={disabled}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Variant
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {variants.map((variant, index) => {
                        const imagePreview = getImagePreview(variant);

                        return (
                            <Card
                                key={index}
                                className={cn(
                                    "transition-all duration-200",
                                    variant.is_default && "ring-2 ring-primary/50 bg-primary/5",
                                    !isPriceValid(variant) && "ring-2 ring-destructive/50"
                                )}
                            >
                                <CardContent className="p-4">
                                    {/* Header Row */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                                        <div className="flex-1 flex items-center gap-2">
                                            <span className="font-medium">
                                                {variant.size_label || `Variant ${index + 1}`}
                                            </span>
                                            {variant.is_default && (
                                                <Badge variant="default" className="text-xs">
                                                    Default
                                                </Badge>
                                            )}
                                            {!isPriceValid(variant) && (
                                                <Badge variant="destructive" className="text-xs">
                                                    Price Error
                                                </Badge>
                                            )}
                                            {getDiscountPercent(variant.mrp, variant.selling_price) > 0 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {getDiscountPercent(variant.mrp, variant.selling_price)}% OFF
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!variant.is_default && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSetDefault(index)}
                                                    disabled={disabled}
                                                    className="text-xs"
                                                >
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Set Default
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveVariant(index)}
                                                disabled={disabled || variants.length === 1}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Size/Unit Controls based on MODE */}
                                    {mode === "UNIT" ? (
                                        <>
                                            {/* Size Presets */}
                                            <div className="mb-4">
                                                <Label className="text-xs text-muted-foreground mb-2 block">
                                                    Quick Size Select
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {SIZE_PRESETS.map((preset) => (
                                                        <Button
                                                            key={preset.label}
                                                            type="button"
                                                            variant={
                                                                variant.size_label === preset.label
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                            size="sm"
                                                            onClick={() => handlePresetSelect(index, preset)}
                                                            disabled={disabled}
                                                            className="text-xs h-7"
                                                        >
                                                            {preset.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Form Fields Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {/* Size Value */}
                                                <div className="space-y-1">
                                                    <Label htmlFor={`variant-size-${index}`} className="text-xs">
                                                        Size Value
                                                    </Label>
                                                    <Input
                                                        id={`variant-size-${index}`}
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={variant.size_value}
                                                        onChange={(e) =>
                                                            handleVariantChange(
                                                                index,
                                                                "size_value",
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        disabled={disabled}
                                                        className="h-9"
                                                    />
                                                </div>

                                                {/* Unit */}
                                                <div className="space-y-1">
                                                    <Label htmlFor={`variant-unit-${index}`} className="text-xs">
                                                        Unit
                                                    </Label>
                                                    <Select
                                                        value={variant.unit}
                                                        onValueChange={(value: VariantUnit) =>
                                                            handleVariantChange(index, "unit", value)
                                                        }
                                                        disabled={disabled}
                                                    >
                                                        <SelectTrigger id={`variant-unit-${index}`} className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {UNIT_OPTIONS.map((opt) => (
                                                                <SelectItem key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Description Field for UNIT Mode */}
                                                <div className="space-y-1 md:col-span-2">
                                                    <Label htmlFor={`variant-desc-${index}`} className="text-xs">
                                                        Description
                                                    </Label>
                                                    <Textarea
                                                        id={`variant-desc-${index}`}
                                                        value={variant.description || ''}
                                                        onChange={(e) => handleVariantChange(index, "description" as keyof VariantFormData, e.target.value)}
                                                        placeholder="• Feature 1&#10;• Feature 2"
                                                        className="min-h-[60px] py-2 resize-y leading-snug"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        // SIZE MODE
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="space-y-1">
                                                <Label htmlFor={`variant-label-${index}`} className="text-xs">
                                                    Size Label (e.g. Small, Medium)
                                                </Label>
                                                {/* Could be Select or Input */}
                                                <div className="flex gap-2 flex-wrap mb-1">
                                                    {SIZE_LABELS_PRESETS.map((label) => (
                                                        <Badge
                                                            key={label}
                                                            variant={variant.size_label === label ? "default" : "outline"}
                                                            className="cursor-pointer hover:bg-primary/20"
                                                            onClick={() => handleVariantChange(index, "size_label", label)}
                                                        >
                                                            {label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <Input
                                                    id={`variant-label-${index}`}
                                                    value={variant.size_label}
                                                    onChange={(e) => handleVariantChange(index, "size_label", e.target.value)}
                                                    placeholder="Enter size label"
                                                    className="h-9"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor={`variant-desc-${index}`} className="text-xs">
                                                    Description (Bullet points supported)
                                                </Label>
                                                <Textarea
                                                    id={`variant-desc-${index}`}
                                                    value={variant.description || ''}
                                                    onChange={(e) => handleVariantChange(index, "description" as keyof VariantFormData, e.target.value)}
                                                    placeholder="• Feature 1&#10;• Feature 2"
                                                    className="min-h-[60px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Price and Stock - Common for both modes (resumed Grid) */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                        {/* MRP */}
                                        <div className="space-y-1">
                                            <Label htmlFor={`variant-mrp-${index}`} className="text-xs">
                                                MRP (₹)
                                            </Label>
                                            <Input
                                                id={`variant-mrp-${index}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={variant.mrp}
                                                onChange={(e) =>
                                                    handleVariantChange(
                                                        index,
                                                        "mrp",
                                                        parseFloat(e.target.value) || 0
                                                    )
                                                }
                                                disabled={disabled}
                                                className="h-9"
                                            />
                                        </div>

                                        {/* Selling Price */}
                                        <div className="space-y-1">
                                            <Label
                                                htmlFor={`variant-price-${index}`}
                                                className={cn(
                                                    "text-xs",
                                                    !isPriceValid(variant) && "text-destructive"
                                                )}
                                            >
                                                Selling Price (₹)
                                            </Label>
                                            <Input
                                                id={`variant-price-${index}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={variant.selling_price}
                                                onChange={(e) =>
                                                    handleVariantChange(
                                                        index,
                                                        "selling_price",
                                                        parseFloat(e.target.value) || 0
                                                    )
                                                }
                                                disabled={disabled}
                                                className={cn(
                                                    "h-9",
                                                    !isPriceValid(variant) && "border-destructive"
                                                )}
                                            />
                                            {!isPriceValid(variant) && (
                                                <p className="text-xs text-destructive">Must be ≤ MRP</p>
                                            )}
                                        </div>

                                        {/* Stock */}
                                        <div className="space-y-1">
                                            <Label htmlFor={`variant-stock-${index}`} className="text-xs">
                                                Stock Quantity
                                            </Label>
                                            <Input
                                                id={`variant-stock-${index}`}
                                                type="number"
                                                min="0"
                                                value={variant.stock_quantity}
                                                onChange={(e) =>
                                                    handleVariantChange(
                                                        index,
                                                        "stock_quantity",
                                                        parseInt(e.target.value) || 0
                                                    )
                                                }
                                                disabled={disabled}
                                                className="h-9"
                                            />
                                        </div>


                                        {/* Variant Image Upload */}
                                        <div className="space-y-1 md:col-span-1">
                                            <Label className="text-xs">
                                                Variant Image
                                            </Label>
                                            {imagePreview ? (
                                                <div className="relative inline-block">
                                                    <img
                                                        src={imagePreview}
                                                        alt={`Variant ${variant.size_label}`}
                                                        className="h-20 w-20 object-cover rounded-lg border"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute -top-2 -right-2 h-6 w-6"
                                                        onClick={() => handleRemoveImage(index)}
                                                        disabled={disabled}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center justify-center h-9 w-full border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                                                    onClick={() => fileInputRefs.current[index]?.click()}
                                                    title="Upload Variant Image"
                                                >
                                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                                    <input
                                                        ref={el => fileInputRefs.current[index] = el}
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                handleImageUpload(index, file);
                                                            }
                                                        }}
                                                        disabled={disabled}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tax Information */}
                                    <div className="mt-4 pt-4 border-t border-dashed">
                                        <Label className="text-xs font-semibold mb-3 block">Tax Information (GST)</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {/* Tax Applicable Toggle */}
                                            <div className="flex items-center space-x-2 h-9">
                                                <input
                                                    type="checkbox"
                                                    id={`tax-app-${index}`}
                                                    checked={variant.tax_applicable !== false}
                                                    onChange={(e) => handleVariantChange(index, "tax_applicable", e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    disabled={disabled}
                                                />
                                                <Label htmlFor={`tax-app-${index}`} className="text-xs font-normal cursor-pointer">
                                                    Tax Applicable
                                                </Label>
                                            </div>

                                            {variant.tax_applicable !== false && (
                                                <>
                                                    {/* HSN Code */}
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`hsn-${index}`} className="text-xs">HSN Code</Label>
                                                        <Input
                                                            id={`hsn-${index}`}
                                                            value={variant.hsn_code || ''}
                                                            onChange={(e) => handleVariantChange(index, "hsn_code", e.target.value)}
                                                            placeholder="e.g. 1905"
                                                            className="h-8 text-xs"
                                                            disabled={disabled}
                                                        />
                                                    </div>

                                                    {/* GST Rate */}
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`gst-${index}`} className="text-xs">GST Rate (%)</Label>
                                                        <Select
                                                            value={variant.gst_rate?.toString() || "0"}
                                                            onValueChange={(value) => handleVariantChange(index, "gst_rate", parseFloat(value))}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger id={`gst-${index}`} className="h-8 text-xs">
                                                                <SelectValue placeholder="Select Rate" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {GST_RATES.map((rate) => (
                                                                    <SelectItem key={rate} value={rate.toString()}>
                                                                        {rate}%
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Price Includes Tax Toggle */}
                                                    <div className="flex items-center space-x-2 h-9 md:col-start-4">
                                                        <input
                                                            type="checkbox"
                                                            id={`inc-tax-${index}`}
                                                            checked={variant.price_includes_tax !== false}
                                                            onChange={(e) => handleVariantChange(index, "price_includes_tax", e.target.checked)}
                                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                            disabled={disabled}
                                                        />
                                                        <Label htmlFor={`inc-tax-${index}`} className="text-xs font-normal cursor-pointer">
                                                            Price includes Tax
                                                        </Label>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add Variant Button */}
            {variants.length > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddVariant}
                    disabled={disabled}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another {mode === 'SIZE' ? 'Size' : 'Unit'} Variant
                </Button>
            )}

            {/* Validation Message */}
            {variants.length > 0 && !variants.some((v) => v.is_default) && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ No default variant selected. The first variant will be used as default.
                </p>
            )}
        </div>
    );
}

