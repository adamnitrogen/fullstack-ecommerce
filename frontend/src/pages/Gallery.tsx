import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { X, Play, ArrowLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Tag } from "@/components/ui/Tag";
import { galleryFolderService, GalleryFolder } from "@/services/gallery-folder.service";
import { galleryItemService, GalleryItem } from "@/services/gallery-item.service";
import { galleryVideoService, GalleryVideo } from "@/services/gallery-video.service";

export default function Gallery() {
  const { t } = useTranslation();
  const [selectedFolder, setSelectedFolder] = useState<GalleryFolder | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Fetch all folders
  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ["gallery-folders-public"],
    queryFn: galleryFolderService.getAll,
  });

  // Fetch items for selected folder
  const { data: items = [] } = useQuery({
    queryKey: ["gallery-items-public", selectedFolder?.id],
    queryFn: () =>
      selectedFolder
        ? galleryItemService.getByFolder(selectedFolder.id)
        : Promise.resolve([]),
    enabled: !!selectedFolder,
  });

  // Fetch all videos
  const { data: allVideos = [] } = useQuery<GalleryVideo[]>({
    queryKey: ["gallery-videos-public"],
    queryFn: () => galleryVideoService.getAll(),
  });

  const handleImageClick = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Filter active folders only
  const activeFolders = folders.filter((f) => f.is_active);

  if (loadingFolders) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("gallery.title")}</h1>
          <p className="text-muted-foreground">{t("gallery.subtitle")}</p>
        </div>

        {/* Gallery Content */}
        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="photos">{t("gallery.photos")}</TabsTrigger>
            <TabsTrigger value="videos">{t("gallery.videos")}</TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos" className="mt-0">
            {selectedFolder ? (
              <div>
                {/* Back button and folder info */}
                <div className="mb-8">
                  <Button
                    variant="outline"
                    className="mb-4"
                    onClick={() => setSelectedFolder(null)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t("gallery.backToAlbums")}
                  </Button>

                  {/* Folder header info */}
                  <div className="bg-muted/50 rounded-lg p-6 mb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-2">
                          {selectedFolder.name}
                        </h2>
                        {selectedFolder.description && (
                          <p className="text-muted-foreground mb-3">
                            {selectedFolder.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{items.length} images</span>
                        </div>
                      </div>
                      <Tag variant="category">{selectedFolder.folder_type}</Tag>
                    </div>
                  </div>
                </div>

                {/* Images grid */}
                {items.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-lg aspect-square cursor-pointer hover-scale transition-all duration-300 shadow-md hover:shadow-xl"
                        onClick={() => handleImageClick(index)}
                      >
                        <img
                          src={item.thumbnail_url || item.image_url}
                          alt={item.title || "Gallery image"}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            {item.title && (
                              <h3 className="text-white font-semibold text-base mb-1">
                                {item.title}
                              </h3>
                            )}
                            {item.description && (
                              <p className="text-white/80 text-xs line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-muted/30 rounded-lg">
                    <p className="text-muted-foreground">
                      No images in this folder yet.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="group relative overflow-hidden rounded-lg aspect-[4/3] cursor-pointer hover-scale transition-all duration-300"
                    onClick={() => setSelectedFolder(folder)}
                  >
                    {/* Folder thumbnail */}
                    {folder.cover_image ? (
                      <img
                        src={folder.cover_image}
                        alt={folder.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : folder.gallery_items && folder.gallery_items.length > 0 ? (
                      <img
                        src={folder.gallery_items[0].thumbnail_url || folder.gallery_items[0].image_url}
                        alt={folder.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <FolderOpen className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

                    {/* Folder icon */}
                    <div className="absolute top-4 right-4">
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                    </div>

                    {/* Folder details */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-white font-bold text-xl mb-2">
                        {folder.name}
                      </h3>
                      {folder.description && (
                        <p className="text-white/80 text-sm line-clamp-2 mb-2">
                          {folder.description}
                        </p>
                      )}
                      <Tag variant="category" className="mt-2">
                        {folder.folder_type}
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeFolders.length === 0 && !selectedFolder && (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <p className="text-muted-foreground">
                  No gallery folders available yet.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos" className="mt-0">
            {allVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allVideos.map((video) => (
                  <div
                    key={video.id}
                    className="group relative overflow-hidden rounded-lg aspect-video cursor-pointer hover-scale"
                    onClick={() => setSelectedVideo(video.youtube_id)}
                  >
                    <img
                      src={
                        video.thumbnail_url ||
                        `https://img.youtube.com/vi/${video.youtube_id}/maxresdefault.jpg`
                      }
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                      <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play
                          className="h-8 w-8 text-primary-foreground ml-1"
                          fill="currentColor"
                        />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <h3 className="text-white font-semibold">{video.title}</h3>
                      {video.description && (
                        <p className="text-white/70 text-sm line-clamp-1 mt-1">
                          {video.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <p className="text-muted-foreground">No videos available yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Lightbox */}
      {lightboxOpen && items.length > 0 && (
        <ImageLightbox
          images={items.map((item) => item.image_url)}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          titles={items.map((item) => item.title || "")}
        />
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setSelectedVideo(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <div
            className="w-full max-w-4xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
