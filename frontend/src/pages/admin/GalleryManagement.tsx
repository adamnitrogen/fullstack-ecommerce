import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FolderOpen,
  Image as ImageIcon,
  Video,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { galleryFolderService, GalleryFolder } from "@/services/gallery-folder.service";
import { galleryItemService, GalleryItem } from "@/services/gallery-item.service";
import { galleryVideoService, GalleryVideo } from "@/services/gallery-video.service";
import { GalleryFolderDialog } from "@/components/admin/GalleryFolderDialog";
import { GalleryVideoDialog } from "@/components/admin/GalleryVideoDialog";
import { GalleryItemUploadDialog } from "@/components/admin/GalleryItemUploadDialog";
import { GalleryItemEditDialog } from "@/components/admin/GalleryItemEditDialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";

export default function GalleryManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<GalleryFolder | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<GalleryVideo | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);

  // Fetch folders
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["gallery-folders"],
    queryFn: galleryFolderService.getAll,
  });

  // Fetch items for selected folder
  const { data: items = [] } = useQuery({
    queryKey: ["gallery-items", selectedFolder?.id],
    queryFn: () =>
      selectedFolder
        ? galleryItemService.getByFolder(selectedFolder.id)
        : Promise.resolve([]),
    enabled: !!selectedFolder,
  });

  // Fetch videos for selected folder
  const { data: videos = [] } = useQuery({
    queryKey: ["gallery-videos", selectedFolder?.id],
    queryFn: () =>
      selectedFolder
        ? galleryVideoService.getByFolder(selectedFolder.id)
        : Promise.resolve([]),
    enabled: !!selectedFolder,
  });

  // Folder mutations
  const saveFolderMutation = useMutation({
    mutationFn: (folderData: Partial<GalleryFolder>) => {
      if (folderData.id) {
        return galleryFolderService.update(folderData.id, folderData);
      } else {
        return galleryFolderService.create(folderData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      toast.success(editingFolder ? t("admin.gallery.toasts.folderUpdated") : t("admin.gallery.toasts.folderCreated"));
      setFolderDialogOpen(false);
      setEditingFolder(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("admin.gallery.toasts.saveFolderError")));
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: galleryFolderService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      setSelectedFolder(null);
      toast.success(t("admin.gallery.toasts.folderDeleted"));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("admin.gallery.toasts.deleteFolderError")));
    },
  });

  const toggleFolderMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      galleryFolderService.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      toast.success(t("admin.gallery.toasts.folderStatus"));
    },
  });

  // Item mutations
  const deleteItemMutation = useMutation({
    mutationFn: galleryItemService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
      toast.success(t("admin.gallery.toasts.imageDeleted"));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("admin.gallery.toasts.deleteImageError")));
    },
  });

  // Video mutations
  const deleteVideoMutation = useMutation({
    mutationFn: galleryVideoService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-videos"] });
      toast.success(t("admin.gallery.toasts.videoDeleted"));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("admin.gallery.toasts.deleteVideoError")));
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GalleryItem> }) =>
      galleryItemService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
    },
  });

  const handleMoveItem = (item: GalleryItem, direction: "up" | "down") => {
    if (!items) return;
    const currentIndex = items.findIndex((i) => i.id === item.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const targetItem = items[targetIndex];

    // Swap order_index
    // If order_index is missing, assume index based on current sort
    const currentOrder = item.order_index ?? currentIndex;
    const targetOrder = targetItem.order_index ?? targetIndex;

    updateItemMutation.mutate({ id: item.id, data: { order_index: targetOrder } });
    updateItemMutation.mutate({ id: targetItem.id, data: { order_index: currentOrder } });
  };

  const handleDeleteFolder = (folder: GalleryFolder) => {
    if (
      confirm(
        t("admin.gallery.deleteFolder", { name: folder.name })
      )
    ) {
      deleteFolderMutation.mutate(folder.id);
    }
  };

  const handleDeleteItem = (item: GalleryItem) => {
    if (confirm(t("admin.gallery.deleteImage"))) {
      deleteItemMutation.mutate(item.id);
    }
  };

  const handleDeleteVideo = (video: GalleryVideo) => {
    if (confirm(t("admin.gallery.deleteVideo"))) {
      deleteVideoMutation.mutate(video.id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">{t("admin.gallery.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.gallery.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.gallery.subtitle")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="folders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="folders">
            <FolderOpen className="h-4 w-4 mr-2" />
            {t("admin.gallery.folders")} ({folders.length})
          </TabsTrigger>
          <TabsTrigger value="images" disabled={!selectedFolder}>
            <ImageIcon className="h-4 w-4 mr-2" />
            {t("admin.gallery.images")} ({items.length})
          </TabsTrigger>
          <TabsTrigger value="videos" disabled={!selectedFolder}>
            <Video className="h-4 w-4 mr-2" />
            {t("admin.gallery.videos")} ({videos.length})
          </TabsTrigger>
        </TabsList>

        {/* Folders Tab */}
        <TabsContent value="folders" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {selectedFolder
                ? `${t("admin.gallery.folder")}: ${selectedFolder.name}`
                : t("admin.gallery.allFolders")}
            </h2>
            <Button
              onClick={() => {
                setEditingFolder(null);
                setFolderDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.gallery.newFolder")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <Card
                key={folder.id}
                className={`cursor-pointer transition-all ${selectedFolder?.id === folder.id
                  ? "ring-2 ring-primary"
                  : ""
                  }`}
                onClick={() => setSelectedFolder(folder)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{folder.name}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge
                          variant={folder.is_active ? "default" : "secondary"}
                        >
                          {folder.is_active ? t("common.active") : t("common.inactive")}
                        </Badge>
                        <Badge variant="outline">
                          {folder.folder_type.toLowerCase() === 'general' ? t("common.general") : folder.folder_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {folder.cover_image && (
                    <img
                      src={folder.cover_image}
                      alt={folder.name}
                      loading="lazy"
                      className="w-full h-32 object-cover rounded-md mb-3"
                    />
                  )}
                  {folder.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {folder.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolderMutation.mutate({
                          id: folder.id,
                          is_active: !folder.is_active,
                        });
                      }}
                    >
                      {folder.is_active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setFolderDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {folders.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">
                {t("admin.gallery.noFolders")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {t("admin.gallery.images")} {t("common.in")} {selectedFolder?.name}
            </h2>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.gallery.uploadImages")}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              .map((item, index) => (
                <Card key={item.id} className="group relative">
                  <CardContent className="p-3">
                    <div className="relative">
                      <img
                        src={item.thumbnail_url || item.image_url}
                        alt={item.title || t("admin.gallery.dialog.preview")}
                        loading="lazy"
                        className="w-full h-40 object-cover rounded-md mb-2"
                      />
                      {/* Reorder Buttons */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded p-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-white hover:bg-white/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveItem(item, "up");
                          }}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-white hover:bg-white/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveItem(item, "down");
                          }}
                          disabled={index === items.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {item.title && (
                      <p className="text-sm font-medium mb-1 truncate">
                        {item.title}
                      </p>
                    )}
                    {item.location && (
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {item.location}
                      </p>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1 h-5">
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setEditingItem(item);
                          setEditItemDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDeleteItem(item)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">
                {t("admin.gallery.noImagesInFolder")}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {t("admin.gallery.videos")} {t("common.in")} {selectedFolder?.name}
            </h2>
            <Button
              onClick={() => {
                setEditingVideo(null);
                setVideoDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.gallery.addVideo")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <Card key={video.id}>
                <CardContent className="p-4">
                  {video.thumbnail_url && (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-40 object-cover rounded-md mb-3"
                    />
                  )}
                  <h3 className="font-medium mb-2">{video.title}</h3>
                  {video.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {video.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEditingVideo(video);
                        setVideoDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleDeleteVideo(video)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">
                {t("admin.gallery.noVideosInFolder")}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <GalleryFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        folder={editingFolder}
        onSave={(data) => saveFolderMutation.mutate(data)}
      />

      <GalleryVideoDialog
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        video={editingVideo}
        defaultFolderId={selectedFolder?.id}
      />

      {selectedFolder && (
        <GalleryItemUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          folderId={selectedFolder.id}
        />
      )}

      <GalleryItemEditDialog
        open={editItemDialogOpen}
        onOpenChange={setEditItemDialogOpen}
        item={editingItem}
      />
    </div>
  );
}
