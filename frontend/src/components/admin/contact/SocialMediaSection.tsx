import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, X, Loader2 } from "lucide-react";
import { SocialMediaLink } from "@/types/contact";
import { socialMediaService } from "@/services/social-media.service";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, getFriendlyTitle } from "@/lib/errorUtils";

const socialPlatforms = [
  { value: "facebook", label: "Facebook", icon: "facebook" },
  { value: "instagram", label: "Instagram", icon: "instagram" },
  { value: "youtube", label: "YouTube", icon: "youtube" },
  { value: "twitter", label: "Twitter/X", icon: "twitter" },
  { value: "linkedin", label: "LinkedIn", icon: "linkedin" },
  { value: "whatsapp", label: "WhatsApp", icon: "phone" },
  { value: "telegram", label: "Telegram", icon: "send" },
  { value: "other", label: "Other", icon: "link" },
];

export function SocialMediaSection() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<Partial<SocialMediaLink>>({
    platform: "",
    url: "",
  });
  const [newLink, setNewLink] = useState<Partial<SocialMediaLink>>({
    platform: "",
    url: "",
  });
  const [isAdding, setIsAdding] = useState(false);

  // Fetch social media links
  const { data: socialMedia = [], isLoading } = useQuery({
    queryKey: ["admin-social-media"],
    queryFn: () => socialMediaService.getAll(true),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: socialMediaService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-social-media"] });
      setNewLink({ platform: "", url: "" });
      setIsAdding(false);
      toast({ title: "Success", description: "Social media link added" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to add link"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SocialMediaLink> }) =>
      socialMediaService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-social-media"] });
      setEditingId(null);
      toast({ title: "Success", description: "Social media link updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to update link"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: socialMediaService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-social-media"] });
      toast({ title: "Success", description: "Social media link removed" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to remove link"),
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if (!newLink.platform || !newLink.url) {
      toast({
        title: "Check your info",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate(newLink);
  };

  const handleUpdate = (id: string, updates: Partial<SocialMediaLink>) => {
    updateMutation.mutate({ id, data: updates });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this link?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading social media links...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Social Media Links</CardTitle>
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Link
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-semibold">Add New Social Media Link</h4>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={newLink.platform}
                onValueChange={(value) =>
                  setNewLink({ ...newLink, platform: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {socialPlatforms.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={newLink.url}
                onChange={(e) =>
                  setNewLink({ ...newLink, url: e.target.value })
                }
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                size="sm"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewLink({ platform: "", url: "" });
                }}
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {socialMedia.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No social media links added yet. Click "Add Link" to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {socialMedia.map((link) => (
              <div
                key={link.id}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                {editingId === link.id ? (
                  <>
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select
                        value={editingLink.platform || link.platform}
                        onValueChange={(value) =>
                          setEditingLink({ ...editingLink, platform: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {socialPlatforms.map((platform) => (
                            <SelectItem
                              key={platform.value}
                              value={platform.value}
                            >
                              {platform.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        value={
                          editingLink.url !== undefined
                            ? editingLink.url
                            : link.url
                        }
                        onChange={(e) =>
                          setEditingLink({
                            ...editingLink,
                            url: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          handleUpdate(link.id, editingLink);
                          setEditingLink({ platform: "", url: "" });
                        }}
                        size="sm"
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Update
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditingLink({ platform: "", url: "" });
                        }}
                        size="sm"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold capitalize">
                          {socialPlatforms.find(
                            (p) => p.value === link.platform
                          )?.label || link.platform}
                        </p>
                        <p className="text-sm text-muted-foreground break-all">
                          {link.url}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingId(link.id);
                            setEditingLink({
                              platform: link.platform,
                              url: link.url,
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(link.id)}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending && deleteMutation.variables === link.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
