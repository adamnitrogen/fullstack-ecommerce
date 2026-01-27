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
import { useTranslation } from "react-i18next";

const socialPlatforms = [
  { value: "facebook", label: "admin.social.platforms.facebook", icon: "facebook" },
  { value: "instagram", label: "admin.social.platforms.instagram", icon: "instagram" },
  { value: "youtube", label: "admin.social.platforms.youtube", icon: "youtube" },
  { value: "twitter", label: "admin.social.platforms.twitter", icon: "twitter" },
  { value: "linkedin", label: "admin.social.platforms.linkedin", icon: "linkedin" },
  { value: "whatsapp", label: "admin.social.platforms.whatsapp", icon: "phone" },
  { value: "telegram", label: "admin.social.platforms.telegram", icon: "send" },
  { value: "other", label: "admin.social.platforms.other", icon: "link" },
];

export function SocialMediaSection() {
  const { t } = useTranslation();
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
      toast({ title: t("common.success"), description: t("admin.social.added") });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t("common.notice")),
        description: getErrorMessage(error, t("admin.social.addError")),
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
      toast({ title: t("common.success"), description: t("admin.social.updated") });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t("common.notice")),
        description: getErrorMessage(error, t("admin.social.updateError")),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: socialMediaService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-social-media"] });
      toast({ title: t("common.success"), description: t("admin.social.removed") });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t("common.notice")),
        description: getErrorMessage(error, t("admin.social.removeError")),
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if (!newLink.platform || !newLink.url) {
      toast({
        title: t("admin.checkInfo"),
        description: t("admin.fillFields"),
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
    if (confirm(t("admin.social.deleteConfirm"))) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">{t("admin.loading.social")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.social.title")}</CardTitle>
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.social.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-semibold">{t("admin.social.addNew")}</h4>
            <div className="space-y-2">
              <Label>{t("admin.social.platform")}</Label>
              <Select
                value={newLink.platform}
                onValueChange={(value) =>
                  setNewLink({ ...newLink, platform: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.social.selectPlatform")} />
                </SelectTrigger>
                <SelectContent>
                  {socialPlatforms.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {t(platform.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.social.url")}</Label>
              <Input
                value={newLink.url}
                onChange={(e) =>
                  setNewLink({ ...newLink, url: e.target.value })
                }
                placeholder={t("admin.social.urlPlaceholder")}
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
                {t("admin.social.save")}
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
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {socialMedia.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("admin.social.empty")}
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
                      <Label>{t("admin.social.platform")}</Label>
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
                              {t(platform.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.social.url")}</Label>
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
                        {t("admin.social.update")}
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
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold capitalize">
                          {t(socialPlatforms.find(
                            (p) => p.value === link.platform
                          )?.label || link.platform)}
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
                          {t("common.edit")}
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
