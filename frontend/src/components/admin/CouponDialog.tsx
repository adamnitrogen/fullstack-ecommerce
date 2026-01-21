import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Search, Check, Sparkles, Tag as TagIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { Coupon, CreateCouponDto, Product } from "@/types";
import { couponService } from "@/services/coupon.service";
import { productService } from "@/services/product.service";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { categoryService } from "@/services/category.service";

interface CouponDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    coupon?: Coupon | null;
    onSave: () => void;
}

export function CouponDialog({
    open,
    onOpenChange,
    coupon,
    onSave,
}: CouponDialogProps) {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [formData, setFormData] = useState<CreateCouponDto>({
        code: "",
        type: "cart",
        discount_percentage: 10,
        valid_until: "",
        is_active: true,
    });

    // Search states
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [openSelector, setOpenSelector] = useState(false);
    const [selectedEntityName, setSelectedEntityName] = useState("");

    // Fetch product categories on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoadingCategories(true);
                const data = await categoryService.getAll("product");
                // Extract unique category names
                const uniqueCategories = [...new Set(data.map((c) => c.name))];
                setCategories(uniqueCategories);
            } catch (error) {
                logger.error("Error fetching categories:", error);
            } finally {
                setLoadingCategories(false);
            }
        };

        if (open) {
            fetchCategories();
        }
    }, [open]);

    useEffect(() => {
        if (coupon) {
            setFormData({
                code: coupon.code,
                type: coupon.type,
                discount_percentage: coupon.discount_percentage,
                target_id: coupon.target_id,
                min_purchase_amount: coupon.min_purchase_amount,
                max_discount_amount: coupon.max_discount_amount,
                valid_from: coupon.valid_from
                    ? new Date(coupon.valid_from).toISOString().split("T")[0]
                    : "",
                valid_until: new Date(coupon.valid_until).toISOString().split("T")[0],
                usage_limit: coupon.usage_limit,
                is_active: coupon.is_active,
            });
        } else {
            // Reset form for new coupon
            setFormData({
                code: "",
                type: "cart",
                discount_percentage: 10,
                valid_until: "",
                is_active: true,
            });
        }
    }, [coupon, open]);

    // Entity search logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (open && (formData.type === 'product' || formData.type === 'variant')) {
                if (searchTerm.length >= 2) {
                    setIsSearching(true);
                    try {
                        const data = await productService.getAll({ search: searchTerm, limit: 10 });
                        setSearchResults(data.products || []);
                    } catch (error) {
                        logger.error("Error searching products:", error);
                    } finally {
                        setIsSearching(false);
                    }
                } else if (searchTerm.length === 0) {
                    // Fetch initial products
                    try {
                        const data = await productService.getAll({ limit: 10 });
                        setSearchResults(data.products || []);
                    } catch (error) { }
                }
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, open, formData.type]);

    // Initial load for search results
    useEffect(() => {
        if (open && (formData.type === 'product' || formData.type === 'variant') && searchResults.length === 0) {
            const fetchInitial = async () => {
                try {
                    const data = await productService.getAll({ limit: 10 });
                    setSearchResults(data.products || []);
                } catch (error) { }
            };
            fetchInitial();
        }
    }, [open, formData.type, searchResults.length]);

    // Set entity name for display when editing
    useEffect(() => {
        if (coupon && (coupon.type === 'product' || coupon.type === 'variant') && coupon.target_id) {
            const fetchEntity = async () => {
                try {
                    const product = await productService.getById(coupon.target_id!.split(':')[0]);
                    if (coupon.type === 'variant') {
                        const variantId = coupon.target_id;
                        const variant = product.variants?.find(v => v.id === variantId);
                        setSelectedEntityName(variant ? `${product.title} (${variant.size_label})` : product.title);
                    } else {
                        setSelectedEntityName(product.title);
                    }
                } catch (error) { }
            };
            fetchEntity();
        } else {
            setSelectedEntityName("");
        }
    }, [coupon]);

    const handleChange = (field: keyof CreateCouponDto, value: string | number | boolean | undefined) => {
        setFormData((prev) => {
            const newData = { ...prev, [field]: value };
            // If type changed to free_delivery, set discount to 1 to satisfy DB constraint
            if (field === 'type' && value === 'free_delivery') {
                newData.discount_percentage = 1;
            } else if (field === 'type' && prev.type === 'free_delivery' && value !== 'free_delivery') {
                // If changing back from free_delivery, set a default discount
                newData.discount_percentage = 10;
            }
            return newData;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare data for submission
        const dataToSave = { ...formData };

        // For free delivery, clear amount constraints as requested
        if (dataToSave.type === 'free_delivery') {
            dataToSave.min_purchase_amount = undefined;
            dataToSave.max_discount_amount = undefined;
            dataToSave.discount_percentage = 1; // Set to 1 to satisfy DB check constraint (>0)
        }

        // Validation
        if (!dataToSave.code || !dataToSave.valid_until) {
            toast.error("Please fill in all required fields");
            return;
        }

        if (dataToSave.type !== "free_delivery" && (dataToSave.discount_percentage < 1 || dataToSave.discount_percentage > 100)) {
            toast.error("Discount percentage must be between 1 and 100");
            return;
        }

        if (
            (dataToSave.type === "product" || dataToSave.type === "category") &&
            !dataToSave.target_id
        ) {
            toast.error(`Please specify a ${dataToSave.type} for this coupon`);
            return;
        }

        try {
            setLoading(true);

            if (coupon) {
                // Update existing coupon
                await couponService.update(coupon.id, dataToSave);
                toast.success("Coupon updated successfully");
            } else {
                // Create new coupon
                await couponService.create(dataToSave);
                toast.success("Coupon created successfully");
            }

            onSave();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to save coupon"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {coupon ? "Edit Coupon" : "Create New Coupon"}
                    </DialogTitle>
                    <DialogDescription>
                        {coupon
                            ? "Update coupon details"
                            : "Create a new discount coupon for your store"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Code */}
                    <div className="grid gap-2">
                        <Label htmlFor="code">
                            Coupon Code <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) =>
                                handleChange("code", e.target.value.toUpperCase())
                            }
                            placeholder="e.g., SAVE20"
                            disabled={loading}
                            required
                        />
                    </div>

                    {/* Type */}
                    <div className="grid gap-2">
                        <Label htmlFor="type">
                            Coupon Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value: "cart" | "category" | "product" | "variant" | "free_delivery") => {
                                handleChange("type", value);
                                // Clear target_id when switching types
                                handleChange("target_id", undefined);
                            }}
                            disabled={loading}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cart">Cart-Level (Apply to entire cart)</SelectItem>
                                <SelectItem value="category">Category-Level (Apply to a category)</SelectItem>
                                <SelectItem value="product">Product-Level (Apply to specific product)</SelectItem>
                                <SelectItem value="variant">Variant-Level (Apply to specific variant)</SelectItem>
                                <SelectItem value="free_delivery">Free Delivery (Waive shipping charges)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Target ID (for product, variant or category) */}
                    {(formData.type === "product" || formData.type === "variant") && (
                        <div className="grid gap-2">
                            <Label htmlFor="target_id">
                                {formData.type === "product" ? "Select Product" : "Select Variant"} <span className="text-destructive">*</span>
                            </Label>

                            <Popover open={openSelector} onOpenChange={setOpenSelector}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openSelector}
                                        className="w-full justify-between font-normal h-11 rounded-xl"
                                        disabled={loading}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {formData.target_id ? (
                                                <>
                                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                                    <span className="truncate">{selectedEntityName || formData.target_id}</span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">Search for a {formData.type}...</span>
                                            )}
                                        </div>
                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl shadow-2xl border-primary/10">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder={`Search for ${formData.type}...`}
                                            onValueChange={setSearchTerm}
                                            value={searchTerm}
                                        />
                                        <CommandList className="max-h-[300px]">
                                            <CommandEmpty className="py-6 text-center text-sm">
                                                {isSearching ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                        <span>Searching...</span>
                                                    </div>
                                                ) : (
                                                    "No results found."
                                                )}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {searchResults.map((product) => (
                                                    <div key={product.id}>
                                                        {formData.type === 'product' ? (
                                                            <CommandItem
                                                                value={product.id}
                                                                onSelect={() => {
                                                                    handleChange("target_id", product.id);
                                                                    setSelectedEntityName(product.title);
                                                                    setOpenSelector(false);
                                                                }}
                                                                className="flex items-center gap-2 p-3"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "h-4 w-4 text-primary",
                                                                        formData.target_id === product.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="font-bold">{product.title}</div>
                                                                    <div className="text-[10px] text-muted-foreground uppercase">{product.category}</div>
                                                                </div>
                                                            </CommandItem>
                                                        ) : (
                                                            // For Variants, show product and its variants
                                                            <div className="px-2 py-1.5">
                                                                <div className="text-[10px] font-black text-primary/50 uppercase px-2 mb-1">{product.title} Variants</div>
                                                                {product.variants && product.variants.length > 0 ? (
                                                                    product.variants.map((v) => (
                                                                        <CommandItem
                                                                            key={v.id}
                                                                            value={v.id}
                                                                            onSelect={() => {
                                                                                handleChange("target_id", v.id);
                                                                                setSelectedEntityName(`${product.title} (${v.size_label})`);
                                                                                setOpenSelector(false);
                                                                            }}
                                                                            className="flex items-center gap-2 p-2 ml-2 rounded-lg"
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "h-4 w-4 text-primary",
                                                                                    formData.target_id === v.id ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            <div className="flex-1">
                                                                                <div className="font-medium">{v.size_label}</div>
                                                                                <div className="text-[10px] text-muted-foreground">₹{v.selling_price} • Stock: {v.stock_quantity}</div>
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))
                                                                ) : (
                                                                    <div className="text-[10px] italic text-muted-foreground px-4 py-1">No variants available</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    {formData.type === "category" && (
                        <div className="grid gap-2">
                            <Label htmlFor="target_id">
                                Category <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={formData.target_id || ""}
                                onValueChange={(value) => handleChange("target_id", value)}
                                disabled={loading || loadingCategories}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingCategories ? "Loading categories..." : "Select category"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Discount Percentage - Hidden for Free Delivery */}
                    {formData.type !== 'free_delivery' && (
                        <div className="grid gap-2">
                            <Label htmlFor="discount">
                                Discount Percentage <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="discount"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.discount_percentage}
                                onChange={(e) =>
                                    handleChange("discount_percentage", parseInt(e.target.value))
                                }
                                disabled={loading}
                                required
                            />
                        </div>
                    )}

                    {formData.type !== 'free_delivery' && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Min Purchase Amount */}
                            <div className="grid gap-2">
                                <Label htmlFor="min_purchase">Minimum Purchase (₹)</Label>
                                <Input
                                    id="min_purchase"
                                    type="number"
                                    min="0"
                                    value={formData.min_purchase_amount || ""}
                                    onChange={(e) =>
                                        handleChange(
                                            "min_purchase_amount",
                                            e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                    }
                                    placeholder="No minimum"
                                    disabled={loading}
                                />
                            </div>

                            {/* Max Discount Amount */}
                            <div className="grid gap-2">
                                <Label htmlFor="max_discount">Max Discount Cap (₹)</Label>
                                <Input
                                    id="max_discount"
                                    type="number"
                                    min="0"
                                    value={formData.max_discount_amount || ""}
                                    onChange={(e) =>
                                        handleChange(
                                            "max_discount_amount",
                                            e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                    }
                                    placeholder="No cap"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Valid From */}
                        <div className="grid gap-2">
                            <Label htmlFor="valid_from">Valid From</Label>
                            <Input
                                id="valid_from"
                                type="date"
                                value={formData.valid_from || ""}
                                onChange={(e) => handleChange("valid_from", e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        {/* Valid Until */}
                        <div className="grid gap-2">
                            <Label htmlFor="valid_until">
                                Valid Until <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="valid_until"
                                type="date"
                                value={formData.valid_until}
                                onChange={(e) => handleChange("valid_until", e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Usage Limit */}
                        <div className="grid gap-2">
                            <Label htmlFor="usage_limit">Usage Limit</Label>
                            <Input
                                id="usage_limit"
                                type="number"
                                min="1"
                                value={formData.usage_limit || ""}
                                onChange={(e) =>
                                    handleChange(
                                        "usage_limit",
                                        e.target.value ? parseInt(e.target.value) : undefined
                                    )
                                }
                                placeholder="Unlimited"
                                disabled={loading}
                            />
                        </div>

                        {/* Active Status */}
                        <div className="grid gap-2">
                            <Label htmlFor="is_active">Status</Label>
                            <Select
                                value={formData.is_active ? "active" : "inactive"}
                                onValueChange={(value) =>
                                    handleChange("is_active", value === "active")
                                }
                                disabled={loading}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {coupon ? "Update" : "Create"} Coupon
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
