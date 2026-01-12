import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { galleryItemService } from "@/services/gallery-item.service";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { uploadService } from "@/services/upload.service";
import { getErrorMessage } from "@/lib/errorUtils";

interface GalleryItemUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folderId: string;
}

export function GalleryItemUploadDialog({
    open,
    onOpenChange,
    folderId,
}: GalleryItemUploadDialogProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        location: string;
        tags: string;
        images: (File | string)[];
    }>({
        title: "",
        description: "",
        location: "",
        tags: "",
        images: [],
    });

    const mutation = useMutation({
        mutationFn: async () => {
            if (formData.images.length === 0) {
                throw new Error("Please upload at least one image");
            }

            const uploadPromises = formData.images.map(async (image, index) => {
                let finalImageUrl = "";

                if (image instanceof File) {
                    const uploadResponse = await uploadService.uploadImage(
                        image,
                        "gallery",
                        folderId
                    );
                    finalImageUrl = uploadResponse.url;
                } else if (typeof image === "string") {
                    finalImageUrl = image;
                }

                if (!finalImageUrl) return null;

                // Process tags
                const tagsArray = formData.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);

                return galleryItemService.create({
                    folder_id: folderId,
                    title: formData.images.length > 1 ? undefined : formData.title, // Only set title if single image
                    description: formData.description,
                    location: formData.location,
                    image_url: finalImageUrl,
                    thumbnail_url: finalImageUrl,
                    order_index: index, // Simple ordering based on selection
                    tags: tagsArray,
                });
            });

            await Promise.all(uploadPromises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            toast.success("Images uploaded successfully");
            onOpenChange(false);
            // Reset form
            setFormData({
                title: "",
                description: "",
                location: "",
                tags: "",
                images: [],
            });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Failed to upload images"));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Upload Images</DialogTitle>
                    <DialogDescription>
                        Add new images to this gallery folder. You can select multiple images.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label>
                            Images <span className="text-destructive">*</span>
                        </Label>
                        <ImageUpload
                            images={formData.images}
                            onChange={(images) => setFormData({ ...formData, images })}
                            maxImages={50}
                            type="gallery"
                        />
                    </div>

                    {/* Common Metadata */}
                    <div className="space-y-4 border-t pt-4">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            Metadata (Applied to all images)
                        </h4>

                        {/* Title - Only show for single image or as a prefix? Let's hide for bulk to avoid confusion or keep optional */}
                        {formData.images.length <= 1 && (
                            <div className="space-y-2">
                                <Label htmlFor="title">Title (Optional)</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) =>
                                        setFormData({ ...formData, title: e.target.value })
                                    }
                                    placeholder="Enter image title"
                                />
                            </div>
                        )}

                        {/* Tags */}
                        <div className="space-y-2">
                            <Label htmlFor="tags">Tags (Optional)</Label>
                            <Input
                                id="tags"
                                value={formData.tags}
                                onChange={(e) =>
                                    setFormData({ ...formData, tags: e.target.value })
                                }
                                placeholder="nature, cow, festival (comma separated)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Separate tags with commas
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="Enter description for these images"
                                rows={3}
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <Label htmlFor="location">Location (Optional)</Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) =>
                                    setFormData({ ...formData, location: e.target.value })
                                }
                                placeholder="e.g., Goshala, Main Farm"
                            />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={mutation.isPending || formData.images.length === 0}
                        >
                            {mutation.isPending ? (
                                "Uploading..."
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload {formData.images.length > 0 ? `${formData.images.length} Images` : "Images"}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
