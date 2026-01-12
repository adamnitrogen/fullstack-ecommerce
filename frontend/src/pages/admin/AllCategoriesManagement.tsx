import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Folder,
  Tag,
  HelpCircle,
  Search,
  Edit,
  Trash2,
  Plus,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { format } from "date-fns";
import { categoryService, Category, CategoryType } from "@/services/category.service";

type CategoryTabType = "product" | "event" | "faq" | "gallery";

export default function AllCategoriesManagement() {
  const [activeTab, setActiveTab] = useState<CategoryTabType>("product");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [categoryName, setCategoryName] = useState("");
  const queryClient = useQueryClient();

  // Product Categories
  const { data: productCategories = [], isLoading: loadingProducts } = useQuery(
    {
      queryKey: ["categories", "product", searchQuery],
      queryFn: async () => {
        const allCategories = await categoryService.getAll("product");
        if (!searchQuery) return allCategories;
        return allCategories.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      },
      enabled: activeTab === "product",
    }
  );

  // Event Categories
  const { data: eventCategories = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["categories", "event", searchQuery],
    queryFn: async () => {
      const allCategories = await categoryService.getAll("event");
      if (!searchQuery) return allCategories;
      return allCategories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
    enabled: activeTab === "event",
  });

  // FAQ Categories
  const { data: faqCategories = [], isLoading: loadingFaqs } = useQuery({
    queryKey: ["categories", "faq", searchQuery],
    queryFn: async () => {
      const allCategories = await categoryService.getAll("faq");
      if (!searchQuery) return allCategories;
      return allCategories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
    enabled: activeTab === "faq",
  });

  // Gallery Categories
  const { data: galleryCategories = [], isLoading: loadingGallery } = useQuery({
    queryKey: ["categories", "gallery", searchQuery],
    queryFn: async () => {
      const allCategories = await categoryService.getAll("gallery");
      if (!searchQuery) return allCategories;
      return allCategories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    },
    enabled: activeTab === "gallery",
  });

  const categoryMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      type,
    }: {
      id?: string;
      name: string;
      type: CategoryType;
    }) => {
      if (id) {
        return categoryService.update(id, { name });
      } else {
        return categoryService.create({ name, type });
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate queries for the specific type
      queryClient.invalidateQueries({ queryKey: ["categories", variables.type] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });

      // Also invalidate related data queries
      if (variables.type === "product") {
        queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      } else if (variables.type === "event") {
        queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      } else if (variables.type === "faq") {
        queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      } else if (variables.type === "gallery") {
        queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      }

      toast({
        title: "Success",
        description: selectedCategory
          ? "Category updated successfully"
          : "Category created successfully",
      });
      setCategoryDialogOpen(false);
      setSelectedCategory(null);
      setCategoryName("");
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save category"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: CategoryType }) => {
      await categoryService.delete(id);
      return { id, type };
    },
    onSuccess: (data) => {
      // Invalidate queries for the specific type
      queryClient.invalidateQueries({ queryKey: ["categories", data.type] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });

      // Also invalidate related data queries
      if (data.type === "product") {
        queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      } else if (data.type === "event") {
        queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      } else if (data.type === "faq") {
        queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      } else if (data.type === "gallery") {
        queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      }

      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete category"),
        variant: "destructive",
      });
    },
  });

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setCategoryName("");
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setCategoryName(category.name);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    categoryMutation.mutate({
      id: selectedCategory?.id,
      name: categoryName.trim(),
      type: activeTab,
    });
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as CategoryType);
    setSearchQuery("");
  };

  const getCurrentCategories = () => {
    if (activeTab === "product") return productCategories;
    if (activeTab === "event") return eventCategories;
    if (activeTab === "gallery") return galleryCategories;
    return faqCategories;
  };

  const isLoading =
    activeTab === "product"
      ? loadingProducts
      : activeTab === "event"
        ? loadingEvents
        : activeTab === "gallery"
          ? loadingGallery
          : loadingFaqs;
  const categories = getCurrentCategories();

  const getIcon = () => {
    if (activeTab === "product") return <Folder className="h-5 w-5" />;
    if (activeTab === "event") return <Tag className="h-5 w-5" />;
    if (activeTab === "gallery") return <Folder className="h-5 w-5" />;
    return <HelpCircle className="h-5 w-5" />;
  };

  const getTitle = () => {
    if (activeTab === "product") return "Product Categories";
    if (activeTab === "event") return "Event Categories";
    if (activeTab === "gallery") return "Gallery Categories";
    return "FAQ Categories";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Category Management</h1>
          <p className="text-muted-foreground">
            Manage categories for products, events, and FAQs
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="product" className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="event" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="gallery" className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Gallery
          </TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            FAQs
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getIcon()}
                  {getTitle()}
                </div>
                <Button onClick={handleAddCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="category-search"
                    name="search"
                    placeholder={`Search ${activeTab} categories...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading categories...
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No categories found. Add your first category to get started.
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium">
                              {category.name}
                            </TableCell>
                            <TableCell>
                              {category.createdAt
                                ? format(
                                  new Date(category.createdAt),
                                  "MMM dd, yyyy"
                                )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditCategory(category)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteCategory(category)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Stats */}
                <div className="text-sm text-muted-foreground pt-4 border-t">
                  Total: {categories.length} {activeTab}{" "}
                  {categories.length !== 1 ? "categories" : "category"}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? "Edit Category" : "Add New Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCategory}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">
                  Category Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="categoryName"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={categoryMutation.isPending}>
                {selectedCategory ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() =>
          selectedCategory &&
          deleteMutation.mutate({ id: selectedCategory.id, type: activeTab })
        }
        title="Delete Category"
        description={`Are you sure you want to delete "${selectedCategory?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
