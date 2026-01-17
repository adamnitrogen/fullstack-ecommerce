import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { GalleryFolder } from "@/services/gallery-folder.service";

import { useQuery } from "@tanstack/react-query";
import { categoryService } from "@/services/category.service";

interface GalleryFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: GalleryFolder | null;
  onSave: (folder: Partial<GalleryFolder>) => void;
}

export function GalleryFolderDialog({
  open,
  onOpenChange,
  folder,
  onSave,
}: GalleryFolderDialogProps) {
  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "gallery"],
    queryFn: () => categoryService.getAll("gallery"),
  });

  const [formData, setFormData] = useState<Partial<GalleryFolder>>({
    name: "",
    description: "",
    slug: "",
    folder_type: "general",
    is_active: true,
    is_hidden: false,
    order_index: 0,
  });

  useEffect(() => {
    if (folder) {
      setFormData(folder);
    } else {
      setFormData({
        name: "",
        description: "",
        slug: "",
        folder_type: "general",
        is_active: true,
        is_hidden: false,
        order_index: 0,
      });
    }
  }, [folder, open]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: folder ? formData.slug : generateSlug(name),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      alert("Folder name is required");
      return;
    }

    if (!formData.slug?.trim()) {
      alert("Folder slug is required");
      return;
    }

    onSave({
      ...formData,
      id: folder?.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {folder ? "Edit Folder" : "Create New Folder"}
          </DialogTitle>
          <DialogDescription>
            {folder
              ? "Update the folder details below"
              : "Create a new gallery folder to organize images and videos"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Folder Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Summer Festival 2024, Goshala Photos"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                URL Slug <span className="text-red-600">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="summer-festival-2024"
                required
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier (auto-generated from name)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder_type">Folder Type</Label>
              <Select
                value={formData.folder_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, folder_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="general">General</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Add a brief description for this folder"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_index">Display Order</Label>
              <Input
                id="order_index"
                type="number"
                value={formData.order_index}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    order_index: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_hidden">Hide from Gallery</Label>
                <p className="text-xs text-muted-foreground">
                  Folder will be accessible via direct link but not listed in gallery
                </p>
              </div>
              <Switch
                id="is_hidden"
                checked={formData.is_hidden}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_hidden: checked })
                }
              />
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
              {folder ? "Update Folder" : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
