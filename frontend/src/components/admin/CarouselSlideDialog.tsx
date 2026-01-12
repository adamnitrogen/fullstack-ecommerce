import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageUpload } from "./ImageUpload";
import { HeroCarouselSlide } from "@/types";
import {
  createCarouselSlide,
  updateCarouselSlide,
} from "@/lib/services/carousel.service";
import { toast } from "sonner";

interface CarouselSlideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide?: HeroCarouselSlide | null;
}

export function CarouselSlideDialog({
  open,
  onOpenChange,
  slide,
}: CarouselSlideDialogProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    image: string;
    title: string;
    subtitle: string;
    order: number;
    isActive: boolean;
    imageFile?: File;
  }>({
    image: "",
    title: "",
    subtitle: "",
    order: 0,
    isActive: true,
    imageFile: undefined,
  });

  useEffect(() => {
    if (slide) {
      setFormData({
        image: slide.image,
        title: slide.title || "",
        subtitle: slide.subtitle || "",
        order: slide.order,
        isActive: slide.isActive,
      });
    } else {
      setFormData({
        image: "",
        title: "",
        subtitle: "",
        order: 0,
        isActive: true,
        imageFile: undefined,
      });
    }
  }, [slide, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formData.image) {
        throw new Error("Image is required");
      }

      let imageUrl = formData.image;
      if (formData.imageFile) {
        const { uploadService } = await import("@/services/upload.service");
        const response = await uploadService.uploadImage(formData.imageFile, 'carousel');
        imageUrl = response.url;
      }

      const slideData = {
        image: imageUrl,
        title: formData.title.trim() || undefined,
        subtitle: formData.subtitle.trim() || undefined,
        order: formData.order,
        isActive: formData.isActive,
      };

      if (slide) {
        return await updateCarouselSlide(slide.id, slideData);
      } else {
        return await createCarouselSlide(slideData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousel-slides"] });
      queryClient.invalidateQueries({ queryKey: ["carousel-slides-admin"] });
      toast.success(
        slide
          ? "Carousel slide updated successfully"
          : "Carousel slide created successfully"
      );
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save carousel slide");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {slide ? "Edit Carousel Slide" : "Add New Carousel Slide"}
          </DialogTitle>
          <DialogDescription>
            {slide
              ? "Update carousel slide image and optional text content"
              : "Add a new slide to the hero carousel with image and optional text"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image">
                Carousel Image <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Recommended size: 1920x600px for best results
              </p>
              <ImageUpload
                images={formData.imageFile ? [formData.imageFile] : (formData.image ? [formData.image] : [])}
                onChange={(images) => {
                  const img = images[0];
                  if (img instanceof File) {
                    setFormData((prev) => ({ ...prev, image: URL.createObjectURL(img), imageFile: img }));
                  } else {
                    setFormData((prev) => ({ ...prev, image: img || "", imageFile: undefined }));
                  }
                }}
                maxImages={1}
                type="carousel"
              />
            </div>

            {/* Content Section */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Slide Content</h4>
                <p className="text-xs text-muted-foreground">
                  If no title or subtitle is provided, buttons will move to
                  bottom center
                </p>
              </div>

              {/* Title (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title{" "}
                  <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g., Nurturing Tradition, Embracing Nature"
                />
              </div>

              {/* Subtitle (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="subtitle">
                  Subtitle{" "}
                  <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subtitle: e.target.value,
                    }))
                  }
                  placeholder="e.g., Pure products from happy, healthy cows"
                  rows={3}
                />
              </div>
            </div>

            {/* Display Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h4 className="text-sm font-medium">Display Settings</h4>

              {/* Order */}
              <div className="space-y-2">
                <Label htmlFor="order">
                  Display Order <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first in the carousel
                </p>
                <Input
                  id="order"
                  type="number"
                  min="0"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      order: parseInt(e.target.value) || 0,
                    }))
                  }
                  required
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Active Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Only active slides will be shown in the carousel
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={mutation.isPending || !formData.image}
          >
            {mutation.isPending
              ? "Saving..."
              : slide
                ? "Update Slide"
                : "Create Slide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
