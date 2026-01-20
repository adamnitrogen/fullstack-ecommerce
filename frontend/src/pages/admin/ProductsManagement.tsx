import { logger } from "@/lib/logger";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Package, Download, ChevronDown, ChevronRight, Truck, ReceiptText, RotateCcw, Info, Percent } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProductDialog } from "@/components/admin/ProductDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, getErrorDetails } from "@/lib/errorUtils";
import { downloadCSV, flattenObject } from "@/lib/exportUtils";
import type { Product, VariantFormData, DeliveryConfig } from "@/types";

// ... (skipping some lines)

export default function ProductsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", searchQuery, page],
    queryFn: async () => {
      const { productService } = await import("@/services/product.service");
      return productService.getAll({ page, limit: 15, search: searchQuery });
    },
  });

  const productMutation = useMutation({
    mutationFn: async (productData: Omit<Partial<Product>, "variants" | "delivery_config"> & { id?: string, imageFiles?: (File | string)[], variants?: VariantFormData[], delivery_config?: Partial<DeliveryConfig> }) => {
      logger.debug("ProductMutation - Received data:", productData);
      const { productService } = await import("@/services/product.service");
      const { uploadService } = await import("@/services/upload.service");
      const { deliveryConfigService } = await import("@/services/delivery-config.service");

      const { variants, imageFiles, delivery_config, ...finalProductData } = productData;
      // Defensive ID check: check productData.id OR selectedProduct.id if editing
      const productId = productData.id || selectedProduct?.id;
      const finalProduct = { ...finalProductData, id: productId } as any;
      const newlyUploadedUrls: string[] = [];

      logger.debug("ProductMutation - Final Product Data:", finalProduct);
      logger.debug("ProductMutation - Detected Product ID:", productId);

      try {
        // 1. Handle main product image uploads
        if (imageFiles && imageFiles.length > 0) {
          const processedImages: string[] = [];
          for (const img of imageFiles) {
            if (img instanceof File) {
              const response = await uploadService.uploadImage(img, 'product');
              processedImages.push(response.url);
              newlyUploadedUrls.push(response.url);
            } else if (typeof img === 'string') {
              if (img.startsWith('blob:')) {
                // Blob URLs are for browser previews only - they should not reach here
                // Skip with warning (this indicates a state sync issue that should be investigated)
                logger.warn("Skipping unexpected blob URL in imageFiles - previews should not leak into form data:", img);
              } else {
                // Valid storage URL - pass through unchanged
                processedImages.push(img);
              }
            }
          }
          finalProduct.images = processedImages;
        }

        // 2. Handle variant image uploads
        const processedVariants = variants ? await Promise.all(variants.map(async (v) => {
          const variant = { ...v };
          if (v.imageFile instanceof File) {
            const response = await uploadService.uploadImage(v.imageFile, 'product');
            variant.variant_image_url = response.url;
            newlyUploadedUrls.push(response.url);
          } else if (typeof v.imageFile === 'string') {
            if (v.imageFile.startsWith('blob:')) {
              // Blob URLs are for browser previews only - skip with warning
              logger.warn("Skipping unexpected blob URL in variant imageFile:", v.imageFile);
            } else {
              // Valid storage URL - pass through unchanged
              variant.variant_image_url = v.imageFile;
            }
          }
          delete variant.imageFile;
          return variant;
        })) : undefined;

        let resultProduct: Product;

        // 3. Save product (with or without variants)
        if (finalProduct.id) {
          logger.debug("ProductMutation - Updating product:", finalProduct.id);
          if (processedVariants && processedVariants.length > 0) {
            resultProduct = await productService.updateWithVariants(finalProduct.id, {
              product: finalProduct,
              variants: processedVariants
            });
          } else {
            resultProduct = await productService.update(finalProduct.id, finalProduct);
          }

          // Handle Delivery Config for Updates
          if (delivery_config && resultProduct && resultProduct.id) {
            try {
              logger.debug("ProductMutation - Saving delivery config for updated product:", resultProduct.id);
              await deliveryConfigService.create({
                ...delivery_config,
                product_id: resultProduct.id,
                scope: 'PRODUCT',
              });
            } catch (err) {
              logger.error("Failed to save delivery config for updated product:", err);
              toast({
                title: "Warning",
                description: "Product updated but failed to save delivery configuration.",
                variant: "destructive",
              });
            }
          }
        } else {
          logger.debug("ProductMutation - Creating new product");
          if (processedVariants && processedVariants.length > 0) {
            resultProduct = await productService.createWithVariants({
              product: { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString() },
              variants: processedVariants
            });
          } else {
            resultProduct = await productService.create(
              { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString() } as Omit<Product, "id">
            );
          }

          // 4. Handle Delivery Config for New Products
          if (delivery_config && resultProduct && resultProduct.id) {
            try {
              logger.debug("ProductMutation - Saving delivery config for new product:", resultProduct.id);
              await deliveryConfigService.create({
                ...delivery_config,
                product_id: resultProduct.id,
                scope: 'PRODUCT',
              });
            } catch (err) {
              logger.error("Failed to save delivery config for new product:", err);
              // Don't throw here to avoid failing the whole product creation
              toast({
                title: "Warning",
                description: "Product created but failed to save delivery configuration.",
                variant: "destructive",
              });
            }
          }
        }

        return resultProduct;
      } catch (error) {
        // Rollback: Delete newly uploaded images if product saving fails
        if (newlyUploadedUrls.length > 0) {
          logger.warn("Product creation/update failed. Rolling back uploaded images...", newlyUploadedUrls);
          await Promise.allSettled(newlyUploadedUrls.map(url =>
            uploadService.deleteImageByUrl(url).catch(err =>
              logger.error(`Failed to rollback image ${url}:`, err)
            )
          ));
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      const productId = variables.id || data?.id;
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({
        title: "Success",
        description: selectedProduct
          ? "Product updated successfully"
          : "Product created successfully",
      });
      setProductDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: unknown) => {
      logger.error("Product mutation error:", error);
      const message = getErrorMessage(error, "Failed to save product. Please check your connection and try again.");
      const details = getErrorDetails(error);

      toast({
        title: "Error",
        description: (
          <div className="space-y-1">
            <p>{message}</p>
            {details && details.length > 0 && (
              <ul className="text-xs list-disc pl-4 mt-1 opacity-90">
                {details.map((detail, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{detail.path.join('.')}:</span> {detail.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { productService } = await import("@/services/product.service");

      // Get the product to access its images
      const product = data?.products?.find(p => p.id === id);
      logger.debug("Deleting product:", id, "Product data:", product);

      // Delete images from Supabase Storage if they exist
      if (product && product.images && product.images.length > 0) {
        logger.debug("Found images to delete:", product.images);
        const { uploadService } = await import("@/services/upload.service");

        for (const imageUrl of product.images) {
          try {
            logger.debug("Attempting to delete image:", imageUrl);
            await uploadService.deleteImageByUrl(imageUrl);
            logger.debug("Successfully deleted image:", imageUrl);
          } catch (error) {
            logger.error(`Failed to delete image ${imageUrl}:`, error);
            // Continue with other images even if one fails
          }
        }
      } else {
        logger.debug("No images to delete for this product");
      }

      // Delete VARIANT images if they exist
      if (product && product.variants && product.variants.length > 0) {
        logger.debug("Checking for variant images to delete...");
        const { uploadService } = await import("@/services/upload.service");

        for (const variant of product.variants) {
          if (variant.variant_image_url) {
            try {
              logger.debug("Attempting to delete variant image:", variant.variant_image_url);
              await uploadService.deleteImageByUrl(variant.variant_image_url);
              logger.debug("Successfully deleted variant image");
            } catch (error) {
              logger.error(`Failed to delete variant image ${variant.variant_image_url}:`, error);
              // Continue with other images
            }
          }
        }
      }

      // Delete the product
      await productService.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: unknown) => {
      logger.error("Delete mutation error:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete product. Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const handleExport = () => {
    if (!data?.products || data.products.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no products to export.",
        variant: "destructive",
      });
      return;
    }

    const exportData = (data?.products || []).map((product) =>
      flattenObject({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        inventory: product.inventory || 0,
        rating: product.rating || 0,
        isNew: product.isNew ? "Yes" : "No",
        createdAt: product.createdAt,
        tags: product.tags?.join(", ") || "",
      })
    );

    downloadCSV(exportData, "products");
    toast({
      title: "Export successful",
      description: "Products data has been downloaded.",
    });
  };

  const handleSaveProduct = (product: Omit<Partial<Product>, "variants" | "delivery_config"> & { imageFiles?: (File | string)[], variants?: VariantFormData[], delivery_config?: Partial<DeliveryConfig> }) => {
    productMutation.mutate(product);
  };

  const handleConfirmDelete = () => {
    if (selectedProduct) {
      deleteMutation.mutate(selectedProduct.id);
    }
  };

  const getStockStatus = (inventory?: number) => {
    if (!inventory || inventory === 0)
      return { label: "Sold Out", variant: "destructive" as const };
    if (inventory < 15)
      return {
        label: "Critical - Only " + inventory + " left",
        variant: "destructive" as const,
      };
    if (inventory < 50)
      return {
        label: "Low Stock - " + inventory + " units",
        variant: "secondary" as const,
      };
    return { label: "In Stock", variant: "default" as const };
  };



  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Products Management
        </h2>
        <p className="text-muted-foreground">
          Manage your product catalog, inventory, and pricing
        </p>
      </div>

      {/* Stock Alerts */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-3">
          {data.stats.outOfStockCount > 0 && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                  <Package className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    Out of Stock
                  </p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {data.stats.outOfStockCount} Products
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {data.stats.criticalStockCount > 0 && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                  <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Critical Stock (&lt; 15)
                  </p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {data.stats.criticalStockCount} Products
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {data.stats.lowStockCount > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                  <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Low Stock (&lt; 50)
                  </p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {data.stats.lowStockCount} Products
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              All Products ({data?.total || 0})
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="product-search"
                  name="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1); // Reset to page 1 on search
                  }}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">Loading products...</div>
          ) : !data?.products || data.products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>MRP Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Config</TableHead>
                      <TableHead>Inventory</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.products || []).map((product) => {
                      const stockStatus = getStockStatus(product.inventory);
                      const isExpanded = expandedProducts.has(product.id);
                      const hasVariants = product.variants && product.variants.length > 0;

                      return (
                        <React.Fragment key={product.id}>
                          <TableRow className={cn(isExpanded && "border-b-0")}>
                            <TableCell>
                              {hasVariants && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => toggleExpand(product.id)}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <img
                                  src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder-image.jpg'}
                                  alt={product.title}
                                  loading="lazy"
                                  className="w-12 h-12 rounded object-cover"
                                />
                                <div>
                                  <p className="font-medium">{product.title}</p>
                                  <p className="text-sm text-muted-foreground truncate max-w-xs">
                                    {product.description}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {product.mrp ? `₹${product.mrp}` : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold">₹{product.price}</span>

                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {/* Returnability */}
                                <div className="flex items-center gap-1.5">
                                  <RotateCcw className={cn("h-3.5 w-3.5", (product.isReturnable === true || (product as any).is_returnable === true) ? "text-green-600" : "text-muted-foreground opacity-50")} />
                                  <span className={cn("text-xs font-medium", (product.isReturnable === true || (product as any).is_returnable === true) ? "text-green-700" : "text-muted-foreground")}>
                                    {(product.isReturnable === true || (product as any).is_returnable === true)
                                      ? `${(product.returnDays !== undefined ? product.returnDays : (product as any).return_days) ?? 0} Days`
                                      : "Not Returnable"}
                                  </span>
                                </div>

                                {/* Delivery */}
                                {product.delivery_config && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5 cursor-help">
                                          <Truck className="h-3.5 w-3.5 text-orange-600" />
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {product.delivery_config.calculation_type === 'FLAT_PER_ORDER' ? 'Flat Order' :
                                              product.delivery_config.calculation_type === 'PER_ITEM' ? 'Per Item' :
                                                product.delivery_config.calculation_type === 'PER_PACKAGE' ? 'Per Pkg' : 'Custom'}
                                            {product.delivery_config.base_delivery_charge > 0 && (
                                              <span className="ml-1 font-medium text-orange-700">(₹{product.delivery_config.base_delivery_charge})</span>
                                            )}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="font-semibold text-xs">Delivery Config</p>
                                        <p className="text-[10px]">Type: {product.delivery_config.calculation_type}</p>
                                        <p className="text-[10px]">Base Charge: ₹{product.delivery_config.base_delivery_charge}</p>
                                        {product.delivery_config.calculation_type === 'PER_PACKAGE' && (
                                          <p className="text-[10px]">Max Items/Pkg: {product.delivery_config.max_items_per_package || 'N/A'}</p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{product.inventory ?? 0} units</span>
                                {hasVariants && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Total across {product.variants?.length} variants
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={stockStatus.variant}>
                                {stockStatus.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditProduct(product)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(product)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && hasVariants && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={8} className="p-0">
                                <div className="p-4 pl-12">
                                  <Table className="border rounded-md bg-background">
                                    <TableHeader className="bg-muted/50">
                                      <TableRow>
                                        <TableHead className="h-8 py-0">Variant</TableHead>
                                        <TableHead className="h-8 py-0">MRP</TableHead>
                                        <TableHead className="h-8 py-0">Price</TableHead>
                                        <TableHead className="h-8 py-0">Tax</TableHead>
                                        <TableHead className="h-8 py-0">Stock</TableHead>
                                        <TableHead className="h-8 py-0">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {product.variants?.map((variant) => {
                                        const variantStockStatus = getStockStatus(variant.stock_quantity);
                                        return (
                                          <TableRow key={variant.id} className="last:border-0">
                                            <TableCell className="py-2">
                                              <div className="flex items-center gap-2">
                                                <img
                                                  src={variant.variant_image_url || product.images?.[0] || '/placeholder-image.jpg'}
                                                  alt={variant.size_label}
                                                  className="w-8 h-8 rounded object-cover border"
                                                />
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-medium">{variant.size_label}</span>
                                                  {variant.is_default && (
                                                    <span className="text-[10px] bg-primary/10 text-primary px-1 rounded w-fit">Default</span>
                                                  )}
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-xs text-muted-foreground">₹{variant.mrp}</TableCell>
                                            <TableCell className="py-2">
                                              <span className="text-sm font-medium">₹{variant.selling_price}</span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                              <div className="flex flex-col text-[10px]">
                                                <span className="text-blue-700 font-medium">{variant.gst_rate || 0}% GST</span>
                                                {variant.hsn_code && <span className="text-muted-foreground">HSN: {variant.hsn_code}</span>}
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-sm">{variant.stock_quantity} units</TableCell>
                                            <TableCell className="py-2">
                                              <Badge variant={variantStockStatus.variant} className="text-[10px] h-5 px-1.5 uppercase">
                                                {variantStockStatus.label.split(' - ')[0]}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, data.total)} of {data.total} products
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 15 >= data.total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onSave={(data) => {
          logger.debug("ProductsManagement - onSave triggered with data:", data);
          productMutation.mutate(data);
        }}
        isSaving={productMutation.isPending}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Product"
        description={`Are you sure you want to delete "${selectedProduct?.title}"? This action cannot be undone.`}
        onConfirm={() => selectedProduct && deleteMutation.mutate(selectedProduct.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
