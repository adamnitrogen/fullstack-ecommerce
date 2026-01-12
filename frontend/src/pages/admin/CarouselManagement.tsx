import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { galleryFolderService } from "@/services/gallery-folder.service";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { Check, Image as ImageIcon, Loader2 } from "lucide-react";

export default function CarouselManagement() {
    const queryClient = useQueryClient();
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // Fetch all folders
    const { data: folders = [], isLoading } = useQuery({
        queryKey: ["gallery-folders"],
        queryFn: galleryFolderService.getAll,
    });

    // Find the current carousel folder
    const currentCarouselFolder = folders.find((f) => f.is_home_carousel);

    // Mutation to set home carousel folder
    const setCarouselMutation = useMutation({
        mutationFn: galleryFolderService.setHomeCarouselFolder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            queryClient.invalidateQueries({ queryKey: ["carousel-slides"] }); // Invalidate homepage cache
            toast.success("Home carousel folder updated successfully");
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, "Failed to update home carousel folder"));
        },
    });

    const handleSetFolder = (folderId: string) => {
        setCarouselMutation.mutate(folderId);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Carousel Management
                </h1>
                <p className="text-muted-foreground">
                    Select a Gallery Folder to populate the homepage carousel.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Carousel Source</CardTitle>
                    <CardDescription>
                        Choose which gallery folder should be displayed on the homepage. The
                        images, titles, and descriptions from the selected folder will be
                        used.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Select
                                    value={currentCarouselFolder?.id || ""}
                                    onValueChange={handleSetFolder}
                                >
                                    <SelectTrigger className="w-[300px]">
                                        <SelectValue placeholder="Select a folder" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {folders.map((folder) => (
                                            <SelectItem key={folder.id} value={folder.id}>
                                                {folder.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {setCarouselMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                            </div>

                            {currentCarouselFolder && (
                                <div className="bg-muted/50 p-4 rounded-lg border">
                                    <div className="flex items-center gap-2 mb-2 text-green-600 font-medium">
                                        <Check className="h-4 w-4" />
                                        Currently Active: {currentCarouselFolder.name}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        This folder's contents are currently being shown on the
                                        homepage carousel.
                                    </p>
                                </div>
                            )}

                            {!currentCarouselFolder && folders.length > 0 && (
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-yellow-800">
                                    <p className="text-sm font-medium">
                                        No folder is currently selected. The homepage carousel might
                                        be empty.
                                    </p>
                                </div>
                            )}

                            {folders.length === 0 && (
                                <div className="bg-muted p-4 rounded-lg text-center">
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-muted-foreground">
                                        No gallery folders found. Please create a folder in Gallery
                                        Management first.
                                    </p>
                                    <Link to="/admin/gallery">
                                        <Button variant="link" className="mt-2">
                                            Go to Gallery Management
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
