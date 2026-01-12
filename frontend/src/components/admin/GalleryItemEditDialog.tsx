import { useState, useEffect } from "react";
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
import { galleryItemService, GalleryItem } from "@/services/gallery-item.service";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { getErrorMessage } from "@/lib/errorUtils";

interface GalleryItemEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: GalleryItem | null;
}

export function GalleryItemEditDialog({
    open,
    onOpenChange,
    item,
}: GalleryItemEditDialogProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        location: string;
        tags: string;
    }>({
        title: "",
        description: "",
        location: "",
        tags: "",
    });

    useEffect(() => {
        if (item) {
            setFormData({
                title: item.title || "",
                description: item.description || "",
                location: item.location || "",
                tags: item.tags ? item.tags.join(", ") : "",
            });
        }
    }, [item]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!item) return;

            // Process tags
            const tagsArray = formData.tags
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0);

            return galleryItemService.update(item.id, {
                title: formData.title,
                description: formData.description,
                location: formData.location,
                tags: tagsArray,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
            toast.success("Image details updated");
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Failed to update image"));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Image Details</DialogTitle>
                    <DialogDescription>
                        Update the details for this image.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Preview */}
                    <div className="flex justify-center">
                        <img
                            src={item.thumbnail_url || item.image_url}
                            alt="Preview"
                            loading="lazy"
                            className="h-48 object-contain rounded-md border"
                        />
                    </div>

                    <div className="space-y-4">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">Title</Label>
                            <Input
                                id="edit-title"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({ ...formData, title: e.target.value })
                                }
                                placeholder="Image title"
                            />
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-tags">Tags</Label>
                            <Input
                                id="edit-tags"
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
                            <Label htmlFor="edit-description">Description</Label>
                            <Textarea
                                id="edit-description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="Image description"
                                rows={3}
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-location">Location</Label>
                            <Input
                                id="edit-location"
                                value={formData.location}
                                onChange={(e) =>
                                    setFormData({ ...formData, location: e.target.value })
                                }
                                placeholder="e.g., Goshala"
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
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? (
                                "Saving..."
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
