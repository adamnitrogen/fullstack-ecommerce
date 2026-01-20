import { logger } from "@/lib/logger";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag } from "@/components/ui/Tag";
import { X, Plus } from "lucide-react";
import type { Blog } from "@/types";
import { ImageUpload } from "./ImageUpload";
import { uploadService } from "@/services/upload.service";

interface BlogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blog: Blog | null;
  onSave: (blog: Partial<Blog> & { imageFile?: File }) => void;
}

export function BlogDialog({
  open,
  onOpenChange,
  blog,
  onSave,
}: BlogDialogProps) {
  const [formData, setFormData] = useState<Partial<Blog> & { imageFile?: File }>({
    title: "",
    excerpt: "",
    content: "",
    author: "",
    image: "",
    tags: [],
    published: false,
    imageFile: undefined,
  });

  const [tagInput, setTagInput] = useState("");
  const [originalImage, setOriginalImage] = useState<string | undefined>();

  useEffect(() => {
    if (blog) {
      setOriginalImage(blog.image);
      setFormData({
        ...blog,
        imageFile: undefined,
      });
    } else {
      setOriginalImage(undefined);
      setFormData({
        title: "",
        excerpt: "",
        content: "",
        author: "",
        image: "",
        tags: [],
        published: false,
        date: new Date().toISOString(),
        imageFile: undefined,
      });
    }
  }, [blog, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.title?.trim() ||
      !formData.author?.trim() ||
      !formData.excerpt?.trim() ||
      !formData.content?.trim()
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Check for either existing image or new image file
    if (!formData.image?.trim() && !formData.imageFile) {
      alert("Please upload a blog image");
      return;
    }

    // Delete old image if it was replaced
    if (originalImage && formData.imageFile instanceof File) {
      logger.debug("Deleting replaced blog image:", originalImage);
      try {
        await uploadService.deleteImageByUrl(originalImage);
        logger.debug("Successfully deleted old blog image:", originalImage);
      } catch (error) {
        logger.error("Failed to delete old blog image: " + originalImage, error);
        // Continue even if deletion fails
      }
    }

    onSave({
      ...formData,
      imageFile: formData.imageFile instanceof File ? formData.imageFile : undefined,
      id: blog?.id,
      date: blog?.date || new Date().toISOString(),
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((tag) => tag !== tagToRemove),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {blog ? "Edit Blog Post" : "Add New Blog Post"}
          </DialogTitle>
          <DialogDescription>
            {blog
              ? "Update blog post content and metadata"
              : "Create a new blog post"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Blog Image */}
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Blog Image
                </h3>
                <span className="text-xs text-red-600">
                  * Required - Upload exactly 1 image
                </span>
              </div>
              <ImageUpload
                images={
                  formData.imageFile
                    ? [formData.imageFile]
                    : formData.image
                      ? [formData.image]
                      : []
                }
                onChange={(images) => {
                  const firstImage = images[0];
                  if (firstImage instanceof File) {
                    setFormData({ ...formData, imageFile: firstImage, image: undefined });
                  } else if (typeof firstImage === 'string') {
                    setFormData({ ...formData, image: firstImage, imageFile: undefined });
                  } else {
                    setFormData({ ...formData, imageFile: undefined, image: undefined });
                  }
                }}
                maxImages={1}
                type="blog"
              />
            </div>

            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Basic Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Blog Title <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter blog title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">
                  Author Name <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="author"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData({ ...formData, author: e.target.value })
                  }
                  placeholder="Enter author name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">
                  Excerpt <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) =>
                    setFormData({ ...formData, excerpt: e.target.value })
                  }
                  placeholder="Brief summary of the blog post (2-3 sentences)"
                  rows={3}
                  required
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This will be shown in blog listings and previews
                </p>
              </div>
            </div>

            {/* Blog Content */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Blog Content
              </h3>

              <div className="space-y-2">
                <Label htmlFor="content">
                  Content <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="content"
                  value={formData.content || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="Write your blog content here..."
                  rows={12}
                  required
                  className="resize-none font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Write the full blog content in plain text
                </p>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Tags</h3>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addTag}
                    size="icon"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {formData.tags && formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <Tag
                        key={tag}
                        variant="default"
                        size="default"
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
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Publish Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Publish Settings
              </h3>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, published: checked as boolean })
                  }
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="published"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Publish immediately
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.published
                      ? "This blog post will be visible to all users immediately"
                      : "Save as draft - you can publish it later"}
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>
                  <strong>Post Date:</strong>{" "}
                  {blog?.date
                    ? new Date(blog.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                    : "Will be set to current date when created"}
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
                {blog ? "Update Blog Post" : "Create Blog Post"}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
