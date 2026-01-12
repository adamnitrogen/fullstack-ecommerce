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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { Coupon, CreateCouponDto } from "@/types";
import { couponService } from "@/services/coupon.service";

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

    // Fetch product categories on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoadingCategories(true);
                const { categoryService } = await import("@/services/category.service");
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

    const handleChange = (field: keyof CreateCouponDto, value: string | number | boolean | undefined) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.code || !formData.valid_until) {
            toast.error("Please fill in all required fields");
            return;
        }

        if (formData.discount_percentage < 1 || formData.discount_percentage > 100) {
            toast.error("Discount percentage must be between 1 and 100");
            return;
        }

        if (
            (formData.type === "product" || formData.type === "category") &&
            !formData.target_id
        ) {
            toast.error(`Please specify a ${formData.type} for this coupon`);
            return;
        }

        try {
            setLoading(true);

            if (coupon) {
                // Update existing coupon
                await couponService.update(coupon.id, formData);
                toast.success("Coupon updated successfully");
            } else {
                // Create new coupon
                await couponService.create(formData);
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
                            onValueChange={(value: "cart" | "category" | "product") => {
                                handleChange("type", value);
                                // Clear target_id when switching types
                                if (value === "cart") {
                                    handleChange("target_id", undefined);
                                }
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
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Target ID (for product or category) */}
                    {formData.type === "product" && (
                        <div className="grid gap-2">
                            <Label htmlFor="target_id">
                                Product ID <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="target_id"
                                value={formData.target_id || ""}
                                onChange={(e) => handleChange("target_id", e.target.value)}
                                placeholder="Enter product ID"
                                disabled={loading}
                                required
                            />
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

                    {/* Discount Percentage */}
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
