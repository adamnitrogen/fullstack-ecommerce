import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "./ImageUpload";
import { VariantFormSection } from "./VariantFormSection";
import type { Product, VariantFormData } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Package, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Omit<Partial<Product>, 'variants'> & { imageFiles?: (File | string)[], variants?: VariantFormData[] }) => void;
  isSaving?: boolean;
}

const AVAILABLE_TAGS = [
  "organic",
  "homemade",
  "eco-friendly",
  "traditional",
  "ayurvedic",
  "fresh",
];

const EMPTY_CATEGORIES: any[] = [];

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
  isSaving = false,
}: ProductDialogProps) {
  // Fetch categories dynamically
  const { data: categories = EMPTY_CATEGORIES } = useQuery({
    queryKey: ["categories", "product"],
    queryFn: async () => {
      const { categoryService } = await import("@/services/category.service");
      return categoryService.getAll("product");
    },
  });
  const [formData, setFormData] = useState<Partial<Product> & { imageFiles?: (File | string)[] }>({
    title: "",
    description: "",
    price: 0,
    mrp: 0,
    images: [],
    imageFiles: [],
    category: "Dairy",
    tags: [],
    inventory: 0,
    benefits: [],
    isReturnable: true,
    returnDays: 3,
    isNew: false,
    createdAt: new Date().toISOString(),
    variant_mode: 'UNIT',
    default_tax_applicable: true,
    default_price_includes_tax: true,
    default_gst_rate: 0,
    default_hsn_code: "",
  });
  const [variants, setVariants] = useState<VariantFormData[]>([]);
  const [variantsOpen, setVariantsOpen] = useState(true);
  const [benefitInput, setBenefitInput] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);

  // Fetch detailed product data when editing
  const { data: detailedProduct, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      const { productService } = await import("@/services/product.service");
      return productService.getById(product.id);
    },
    enabled: !!product?.id && open,
  });

  useEffect(() => {
    if (open) {
      if (product) {
        // Use detailedProduct if available, otherwise fallback to product prop
        const productData = detailedProduct || product;

        // Store original images to track deletions
        const originalImageUrls = productData.images || [];
        setOriginalImages(originalImageUrls);
        setRemovedImages([]);

        setFormData({
          ...productData,
          id: productData.id, // Ensure ID is explicitly kept
          mrp: productData.mrp || productData.price,
          isReturnable: (productData as any).is_returnable !== undefined ? (productData as any).is_returnable : (productData.isReturnable !== false),
          returnDays: (productData as any).return_days || productData.returnDays || 3,
          imageFiles: originalImageUrls,
          default_hsn_code: productData.default_hsn_code || (productData as any).default_hsn_code || "",
          default_gst_rate: productData.default_gst_rate ?? (productData as any).default_gst_rate ?? 0,
          default_tax_applicable: (productData as any).default_tax_applicable !== undefined ? (productData as any).default_tax_applicable : (productData.default_tax_applicable !== false),
          default_price_includes_tax: (productData as any).default_price_includes_tax !== undefined ? (productData as any).default_price_includes_tax : (productData.default_price_includes_tax !== false),
        });

        // Initialize variants from product
        if (productData.variants && productData.variants.length > 0) {
          setVariants(productData.variants.map((v: any) => ({
            id: v.id,
            size_label: v.size_label,
            size_value: v.size_value,
            unit: v.unit,
            mrp: v.mrp,
            selling_price: v.selling_price,
            stock_quantity: v.stock_quantity,
            variant_image_url: v.variant_image_url,
            is_default: v.is_default,
            hsn_code: v.hsn_code || "",
            gst_rate: v.gst_rate || 0,
            tax_applicable: v.tax_applicable !== false,
            price_includes_tax: v.price_includes_tax !== false,
          })));
        } else {
          setVariants([]);
        }
      } else {
        setOriginalImages([]);
        setRemovedImages([]);
        setVariants([]);

        setFormData({
          title: "",
          description: "",
          price: 0,
          mrp: 0,
          images: [],
          imageFiles: [],
          category: categories.length > 0 ? categories[0].name : "Dairy",
          tags: [],
          inventory: 0,
          benefits: [],
          isReturnable: true,
          returnDays: 3,
          isNew: true,
          createdAt: new Date().toISOString(),
          variant_mode: 'UNIT',
          default_hsn_code: "",
          default_gst_rate: 0,
          default_tax_applicable: true,
          default_price_includes_tax: true,
        });
      }
      setBenefitInput("");
      setCustomTag("");
    } else {
      // Reset state on close to prevent stale data and blob URL errors
      setOriginalImages([]);
      setRemovedImages([]);
      setVariants([]);
      setFormData({
        title: "",
        description: "",
        price: 0,
        mrp: 0,
        images: [],
        imageFiles: [],
        category: categories.length > 0 ? categories[0].name : "Dairy",
        tags: [],
        inventory: 0,
        benefits: [],
        isReturnable: true,
        returnDays: 3,
        isNew: false,
        createdAt: new Date().toISOString(),
        variant_mode: 'UNIT',
        default_tax_applicable: true,
        default_price_includes_tax: true,
        default_gst_rate: 0,
        default_hsn_code: "",
      });
      setBenefitInput("");
      setCustomTag("");
    }
  }, [product, detailedProduct, open, categories]);

  // Inventory Calculation Effect
  useEffect(() => {
    if (variants && variants.length > 0) {
      const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
      // Only update if different to avoid infinite loops
      if (formData.inventory !== totalStock) {
        setFormData(prev => ({ ...prev, inventory: totalStock }));
      }
    }
  }, [variants, formData.inventory]); // Added formData.inventory to correct deps, but carefully managed inside

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.debug("ProductDialog - Submitting product:", formData);

    // Validate required fields
    if (!formData.title?.trim() || !formData.description?.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate Price/MRP only if NO variants are present
    if (variants.length === 0) {
      if (!formData.price || !formData.mrp) {
        alert("Price and MRP are required when no variants are added.");
        return;
      }
    }

    // Check for either existing images or new image files
    if ((!formData.imageFiles || formData.imageFiles.length === 0) && (!formData.images || formData.images.length === 0)) {
      alert("Please upload at least one product image");
      return;
    }

    // Delete removed images from Supabase Storage
    if (removedImages.length > 0) {
      logger.debug("Deleting removed images:", removedImages);
      const { uploadService } = await import("@/services/upload.service");

      for (const imageUrl of removedImages) {
        try {
          await uploadService.deleteImageByUrl(imageUrl);
          logger.debug("Deleted removed image:", imageUrl);
        } catch (error) {
          logger.error("Failed to delete removed image: " + imageUrl, error);
          // Continue even if deletion fails
        }
      }
    }

    // Pass imageFiles and variants to parent
    onSave({
      ...formData,
      imageFiles: formData.imageFiles,
      variants,
    });
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = formData.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    setFormData({ ...formData, tags: newTags });
  };

  const handleImagesChange = (images: (string | File)[]) => {
    // Track which images were removed
    const currentImageUrls = images.filter(img => typeof img === 'string') as string[];
    const removed = originalImages.filter(url => !currentImageUrls.includes(url));

    setRemovedImages(removed);
    setFormData({ ...formData, imageFiles: images });
  };

  const discountPercentage =
    formData.mrp && formData.price && formData.mrp > formData.price
      ? Math.round(((formData.mrp - formData.price) / formData.mrp) * 100)
      : 0;

  const addCustomTag = () => {
    if (
      customTag.trim() &&
      !formData.tags?.includes(customTag.trim().toLowerCase())
    ) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), customTag.trim().toLowerCase()],
      });
      setCustomTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t) => t !== tag),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {product ? "Edit Product" : "Add New Product"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Update the details of your product below. Click save when you're done."
              : "Fill in the details to create a new product. Click save when you're done."}
          </DialogDescription>
        </DialogHeader>

        {/* Loading Overlay for Save Operations */}
        <LoadingOverlay
          isLoading={isSaving}
          message={product ? "Updating product..." : "Creating product..."}
        />

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Product Images */}
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="text-base font-semibold">
                Product Images (Max 5)
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Upload up to 5 high-quality images of the product
              </p>
              <ImageUpload
                images={formData.imageFiles || []}
                onChange={handleImagesChange}
                maxImages={5}
                type="product"
              />
            </div>

            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Basic Information</h3>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter detailed product description"
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category}
                  name="category"
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="no-categories" disabled>
                        No categories available
                      </SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Pricing</h3>
              {variants.length > 0 && (
                <p className="text-xs text-muted-foreground -mt-2">
                  💡 Pricing is optional. If left blank, it will be auto-set to the lowest variant price.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mrp">
                    MRP Price (₹) {variants.length === 0 && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="mrp"
                    name="mrp"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.mrp || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mrp: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder={variants.length > 0 ? "Auto-calculated if empty" : "Original price"}
                    required={variants.length === 0}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">
                    Selling Price (₹){" "}
                    {variants.length === 0 && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder={variants.length > 0 ? "Auto-calculated if empty" : "Discounted price"}
                    required={variants.length === 0}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_charge">
                    Base Delivery Charge (₹)
                  </Label>
                  <Input
                    id="delivery_charge"
                    name="delivery_charge"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.delivery_charge ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delivery_charge: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="e.g. 50"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Per-unit delivery fee for this product (Default for all variants)
                  </p>
                </div>
              </div>

              {discountPercentage > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Discount: {discountPercentage}% off
                  </p>
                </div>
              )}
            </div>

            {/* Tax Configuration */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Tax Configuration (Default)</h3>
              <p className="text-sm text-muted-foreground">
                Set default tax rates for this product. These apply when no variants are used, or as a fallback.
              </p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="default-tax-applicable"
                  checked={formData.default_tax_applicable !== false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, default_tax_applicable: checked as boolean })
                  }
                />
                <Label htmlFor="default-tax-applicable">Tax Applicable</Label>
              </div>

              {formData.default_tax_applicable !== false && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default-hsn">HSN Code</Label>
                    <Input
                      id="default-hsn"
                      value={formData.default_hsn_code || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, default_hsn_code: e.target.value })
                      }
                      placeholder="e.g. 1905"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-gst">GST Rate (%)</Label>
                    <Select
                      value={formData.default_gst_rate?.toString() || "0"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, default_gst_rate: parseFloat(value) })
                      }
                    >
                      <SelectTrigger id="default-gst">
                        <SelectValue placeholder="Select Rate" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 5, 12, 18, 28].map((rate) => (
                          <SelectItem key={rate} value={rate.toString()}>
                            {rate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 md:col-span-2">
                    <Checkbox
                      id="default-inc-tax"
                      checked={formData.default_price_includes_tax !== false}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, default_price_includes_tax: checked as boolean })
                      }
                    />
                    <Label htmlFor="default-inc-tax">Price includes Tax</Label>
                  </div>
                </div>
              )}
            </div>

            {/* Variant Mode Selection */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Variant Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose how variants are defined for this product
                  </p>
                </div>
                <div className="flex items-center space-x-2 bg-background p-1 rounded-lg border">
                  <Button
                    type="button"
                    variant={formData.variant_mode === 'UNIT' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      // Clear variants if mode changes to avoid schema mismatch
                      if (formData.variant_mode !== 'UNIT' && variants.length > 0) {
                        if (confirm("Changing variant mode will clear existing variants. Continue?")) {
                          setVariants([]);
                          setFormData({ ...formData, variant_mode: 'UNIT' });
                        }
                      } else {
                        setFormData({ ...formData, variant_mode: 'UNIT' });
                      }
                    }}
                  >
                    Weight/Unit Based
                  </Button>
                  <Button
                    type="button"
                    variant={formData.variant_mode === 'SIZE' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      if (formData.variant_mode !== 'SIZE' && variants.length > 0) {
                        if (confirm("Changing variant mode will clear existing variants. Continue?")) {
                          setVariants([]);
                          setFormData({ ...formData, variant_mode: 'SIZE' });
                        }
                      } else {
                        setFormData({ ...formData, variant_mode: 'SIZE' });
                      }
                    }}
                  >
                    Size/Description Based
                  </Button>
                </div>
              </div>
            </div>

            {/* Size Variants */}
            <Collapsible open={variantsOpen} onOpenChange={setVariantsOpen}>
              <div className="space-y-4 border rounded-lg p-4">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -m-4 p-4 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-base font-semibold">
                        {formData.variant_mode === 'SIZE' ? 'Size Variants' : 'Unit Variants'}
                      </h3>
                      {variants.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {variants.length} variant{variants.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {variants.length > 0 && !variants.some(v => v.is_default) && (
                        <Badge variant="destructive" className="ml-1 text-xs">
                          No default
                        </Badge>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm">
                      {variantsOpen ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <VariantFormSection
                    variants={variants}
                    onChange={setVariants}
                    mode={formData.variant_mode || 'UNIT'}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>


            {/* Inventory */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Inventory Management</h3>

              <div className="space-y-2">
                <Label htmlFor="inventory">
                  Stock Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inventory"
                  name="inventory"
                  type="number"
                  min="0"
                  value={formData.inventory}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      inventory: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="Available stock quantity"
                  required
                />
                {formData.inventory !== undefined &&
                  formData.inventory < 15 && (
                    <p className="text-sm text-destructive font-medium">
                      ⚠️ Low stock alert: Only {formData.inventory} items
                      remaining
                    </p>
                  )}
                {formData.inventory !== undefined &&
                  formData.inventory >= 15 &&
                  formData.inventory < 50 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ Stock running low: {formData.inventory} items remaining
                    </p>
                  )}
              </div>
            </div>

            {/* Key Benefits */}
            <div className="space-y-3 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Key Benefits</h3>
              <p className="text-sm text-muted-foreground">
                Add product benefits that will be displayed as checkmark bullet
                points
              </p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    id="benefit-input"
                    name="benefitInput"
                    aria-label="Add a benefit"
                    placeholder="Add a benefit (e.g., 100% Pure & Natural)"
                    value={benefitInput}
                    onChange={(e) => setBenefitInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (benefitInput.trim()) {
                          setFormData({
                            ...formData,
                            benefits: [
                              ...(formData.benefits || []),
                              benefitInput.trim(),
                            ],
                          });
                          setBenefitInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      if (benefitInput.trim()) {
                        setFormData({
                          ...formData,
                          benefits: [
                            ...(formData.benefits || []),
                            benefitInput.trim(),
                          ],
                        });
                        setBenefitInput("");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.benefits && formData.benefits.length > 0 && (
                  <div className="space-y-2">
                    {(formData.benefits || []).map((benefit, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded-md border"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 dark:text-green-400">
                            ✓
                          </span>
                          <span className="text-sm">{benefit}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              benefits: (formData.benefits || []).filter(
                                (_, i) => i !== index
                              ),
                            });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product Tags */}
            <div className="space-y-3 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Product Tags</h3>
              <p className="text-sm text-muted-foreground">
                Select existing tags or add custom tags. "New" tag automatically
                applies for 2 months.
              </p>

              {/* Existing Tags */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {AVAILABLE_TAGS.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag}`}
                      checked={formData.tags?.includes(tag)}
                      onCheckedChange={() => handleTagToggle(tag)}
                    />
                    <Label
                      htmlFor={`tag-${tag}`}
                      className="text-sm font-normal cursor-pointer capitalize"
                    >
                      {tag}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Custom Tags */}
              <div className="space-y-2">
                <Label className="text-sm">Add Custom Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-tag-input"
                    name="customTagInput"
                    aria-label="Add custom tag"
                    placeholder="Enter custom tag"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={addCustomTag}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Selected Tags Display */}
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(formData.tags || []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="default"
                      className="px-3 py-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Return Policy */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Return Policy</h3>

              <div className="space-y-4">
                <Label>Return Policy</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="returnable"
                      name="returnPolicy"
                      checked={formData.isReturnable === true}
                      onChange={() => setFormData({ ...formData, isReturnable: true, returnDays: formData.returnDays || 3 })}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="returnable" className="font-normal cursor-pointer">
                      Returnable
                    </Label>
                  </div>

                  {formData.isReturnable && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="returnDays" className="text-sm">
                        Return Window (Days)
                      </Label>
                      <Input
                        id="returnDays"
                        name="returnDays"
                        type="number"
                        min="1"
                        max="30"
                        value={formData.returnDays?.toString()}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData({ ...formData, returnDays: parseInt(value) });
                        }}
                        placeholder="e.g., 3"
                        className="w-32"
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of days customers can return the product
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="non-returnable"
                      name="returnPolicy"
                      checked={formData.isReturnable === false}
                      onChange={() => setFormData({ ...formData, isReturnable: false, returnDays: 0 })}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="non-returnable" className="font-normal cursor-pointer">
                      Non-returnable
                    </Label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose whether this product can be returned after purchase
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {product ? "Update Product" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
