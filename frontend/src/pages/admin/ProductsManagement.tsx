import { logger } from "@/lib/logger";
import { useState } from "react";
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
import { Plus, Search, Edit, Trash2, Package, Download } from "lucide-react";
import { ProductDialog } from "@/components/admin/ProductDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { downloadCSV, flattenObject } from "@/lib/exportUtils";
import type { Product, VariantFormData } from "@/types";

export default function ProductsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", searchQuery, page],
    queryFn: async () => {
      const { productService } = await import("@/services/product.service");
      return productService.getAll({ page, limit: 15, search: searchQuery });
    },
  });

  const productMutation = useMutation({
    mutationFn: async (productData: Omit<Partial<Product>, "variants"> & { imageFiles?: (File | string)[], variants?: VariantFormData[] }) => {
      logger.debug("ProductMutation - Received product:", productData);
      const { productService } = await import("@/services/product.service");
      const { uploadService } = await import("@/services/upload.service");

      const { variants, imageFiles, ...finalProductData } = productData;
      const finalProduct = { ...finalProductData } as any;
      const newlyUploadedUrls: string[] = [];

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
                // Convert blob URL to File and upload
                try {
                  const blob = await fetch(img).then(r => r.blob());
                  const file = new File([blob], "image.jpg", { type: blob.type });
                  const response = await uploadService.uploadImage(file, 'product');
                  processedImages.push(response.url);
                  newlyUploadedUrls.push(response.url);
                } catch (err) {
                  logger.error("Failed to process blob image:", err);
                  // If conversion fails, try to proceed without it or throw
                }
              } else {
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
              // Convert blob URL to File and upload
              try {
                const blob = await fetch(v.imageFile).then(r => r.blob());
                const file = new File([blob], "variant-image.jpg", { type: blob.type });
                const response = await uploadService.uploadImage(file, 'product');
                variant.variant_image_url = response.url;
                newlyUploadedUrls.push(response.url);
              } catch (err) {
                logger.error("Failed to process variant blob image:", err);
              }
            } else {
              variant.variant_image_url = v.imageFile;
            }
          }
          delete variant.imageFile;
          return variant;
        })) : undefined;

        // 3. Save product (with or without variants)
        if (finalProduct.id) {
          logger.debug("ProductMutation - Updating product:", finalProduct.id);
          if (processedVariants && processedVariants.length > 0) {
            return await productService.updateWithVariants(finalProduct.id, {
              product: finalProduct,
              variants: processedVariants
            });
          }
          return await productService.update(finalProduct.id, finalProduct);
        } else {
          logger.debug("ProductMutation - Creating new product");
          if (processedVariants && processedVariants.length > 0) {
            return await productService.createWithVariants({
              product: { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString() },
              variants: processedVariants
            });
          }
          return await productService.create(
            { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString() } as Omit<Product, "id">
          );
        }
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
    onSuccess: () => {
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
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save product. Please check your connection and try again."),
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

  const handleSaveProduct = (product: Partial<Product> & { imageFiles?: (File | string)[] }) => {
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
            <div className="text-center py-12">Loading...</div>
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
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>MRP Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Inventory</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.products || []).map((product) => {
                      const stockStatus = getStockStatus(product.inventory);
                      return (
                        <TableRow key={product.id}>
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
                          <TableCell className="font-semibold">
                            ₹{product.price}
                          </TableCell>
                          <TableCell>{product.inventory ?? 0} units</TableCell>
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
        onSave={(data) => productMutation.mutate(data)}
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
