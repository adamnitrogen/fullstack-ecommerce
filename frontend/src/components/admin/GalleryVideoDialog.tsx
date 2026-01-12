import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { galleryVideoService, GalleryVideo } from "@/services/gallery-video.service";
import { galleryFolderService } from "@/services/gallery-folder.service";
import { toast } from "sonner";

interface GalleryVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video?: GalleryVideo | null;
  defaultFolderId?: string;
}

export function GalleryVideoDialog({
  open,
  onOpenChange,
  video,
  defaultFolderId,
}: GalleryVideoDialogProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    folder_id: defaultFolderId || "",
    youtube_url: "",
    title: "",
    description: "",
    tags: [] as string[],
  });
  const [extractedId, setExtractedId] = useState("");

  // Fetch folders for selection
  const { data: folders = [] } = useQuery({
    queryKey: ["gallery-folders"],
    queryFn: galleryFolderService.getAll,
  });

  useEffect(() => {
    if (video) {
      setFormData({
        folder_id: video.folder_id,
        youtube_url: video.youtube_url,
        title: video.title || "",
        description: video.description || "",
        tags: video.tags || [],
      });
      setExtractedId(video.youtube_id);
    } else if (!open) {
      setFormData({
        folder_id: defaultFolderId || "",
        youtube_url: "",
        title: "",
        description: "",
        tags: [],
      });
      setExtractedId("");
    }
  }, [video, open, defaultFolderId]);

  const extractYouTubeId = (url: string): string => {
    if (!url) return "";

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return url;
  };

  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, youtube_url: url });
    const id = extractYouTubeId(url);
    setExtractedId(id);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const videoData = {
        folder_id: formData.folder_id,
        youtube_url: formData.youtube_url,
        title: formData.title,
        description: formData.description,
        tags: formData.tags,
      };

      if (video) {
        return galleryVideoService.update(video.id, videoData);
      } else {
        return galleryVideoService.create(videoData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-videos-all"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-videos"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      toast.success(
        video ? "Video updated successfully" : "Video added successfully"
      );
      onOpenChange(false);
    },
    onError: () => {
      toast.error(video ? "Failed to update video" : "Failed to add video");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.folder_id) {
      toast.error("Please select a folder");
      return;
    }

    if (!extractedId) {
      toast.error("Please enter a valid YouTube URL");
      return;
    }

    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {video ? "Edit Video" : "Add New Video"}
          </DialogTitle>
          <DialogDescription>
            {video
              ? "Update the video details and metadata"
              : "Add a new YouTube video to the gallery"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Video Preview */}
          {extractedId && (
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="text-base font-semibold">Video Preview</Label>
              <div className="aspect-video rounded-md overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${extractedId}`}
                  title="Video preview"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Folder Selection */}
          <div className="space-y-2">
            <Label htmlFor="folder">
              Folder <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.folder_id}
              onValueChange={(value) =>
                setFormData({ ...formData, folder_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name} ({folder.folder_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Video URL */}
          {!video && (
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">YouTube Video URL</h3>

              <div className="space-y-2">
                <Label htmlFor="youtubeUrl">
                  YouTube URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="youtubeUrl"
                  value={formData.youtube_url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Paste the full YouTube URL
                </p>
              </div>
            </div>
          )}

          {/* Video Information */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="text-base font-semibold">Video Information</h3>

            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter video title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter video description"
                rows={4}
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving..."
                : video
                  ? "Update Video"
                  : "Add Video"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
