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
import type { Product } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Partial<Product> & { imageFiles?: (File | string)[] }) => void;
}

const AVAILABLE_TAGS = [
  "organic",
  "homemade",
  "eco-friendly",
  "traditional",
  "ayurvedic",
  "fresh",
];

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: ProductDialogProps) {
  // Fetch categories dynamically
  const { data: categories = [] } = useQuery({
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
  });
  const [benefitInput, setBenefitInput] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (product) {
        // Store original images to track deletions
        const originalImageUrls = product.images || [];
        setOriginalImages(originalImageUrls);
        setRemovedImages([]);

        setFormData({
          ...product,
          mrp: product.mrp || product.price,
          isReturnable: product.isReturnable !== false,
          returnDays: product.returnDays || 3,
          imageFiles: originalImageUrls,
        });
      } else {
        setOriginalImages([]);
        setRemovedImages([]);

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
        });
      }
      setBenefitInput("");
      setCustomTag("");
    }
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.debug("ProductDialog - Submitting product:", formData);

    // Validate required fields
    if (!formData.title?.trim() || !formData.description?.trim()) {
      alert("Please fill in all required fields");
      return;
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

    // Pass imageFiles to parent - image upload will be handled in ProductsManagement
    onSave({
      ...formData,
      imageFiles: formData.imageFiles,
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
                  <SelectTrigger>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mrp">
                    MRP Price (₹) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mrp"
                    name="mrp"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mrp: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Original price"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">
                    Selling Price (₹){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Discounted price"
                    required
                  />
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
                    {formData.benefits.map((benefit, index) => (
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
                              benefits: formData.benefits?.filter(
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
                  {formData.tags.map((tag) => (
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
              >
                Cancel
              </Button>
              <Button type="submit">
                {product ? "Update Product" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
