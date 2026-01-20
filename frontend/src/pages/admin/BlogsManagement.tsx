import { logger } from "@/lib/logger";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/Tag";
import {
  FileText,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { BlogDialog } from "@/components/admin/BlogDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import type { Blog } from "@/types";
import { format } from "date-fns";
import { blogService } from "@/services/blog.service";
import { uploadService } from "@/services/upload.service";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function BlogsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [blogDialogOpen, setBlogDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blogs", page, limit, searchQuery],
    queryFn: async () => {
      return blogService.getPaginated(page, limit, searchQuery);
    },
  });

  const blogs = data?.blogs || [];
  const totalPages = data?.totalPages || 0;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const blogMutation = useMutation({
    mutationFn: async (blogData: Partial<Blog> & { imageFile?: File }) => {
      const finalBlog = { ...blogData };

      // Handle image upload if file is present
      if (blogData.imageFile) {
        const response = await uploadService.uploadImage(blogData.imageFile, 'blog');
        finalBlog.image = response.url;
        // Remove imageFile from the object sent to API
        delete finalBlog.imageFile;
      }

      if (finalBlog.id) {
        return blogService.update(finalBlog.id, finalBlog);
      } else {
        return blogService.create(finalBlog as Omit<Blog, "id">);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast({
        title: "Success",
        description: selectedBlog
          ? "Blog updated successfully"
          : "Blog created successfully",
      });
      setBlogDialogOpen(false);
      setSelectedBlog(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save blog"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (blogId: string) => {
      // Get the blog to access its image
      const blog = blogs.find(b => b.id === blogId);

      // Delete image from Supabase Storage if it exists
      if (blog && blog.image) {
        try {
          logger.debug("Deleting blog image:", blog.image);
          await uploadService.deleteImageByUrl(blog.image);
          logger.debug("Successfully deleted blog image");
        } catch (error) {
          logger.error("Failed to delete blog image:", error);
          // Continue with blog deletion even if image deletion fails
        }
      }

      // Delete the blog
      await blogService.delete(blogId);
      return blogId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast({
        title: "Success",
        description: "Blog deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedBlog(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete blog"),
        variant: "destructive",
      });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({
      id,
      published,
    }: {
      id: string;
      published: boolean;
    }) => {
      await blogService.update(id, { published });
      return { id, published };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast({
        title: "Success",
        description: "Blog status updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update blog status"),
        variant: "destructive",
      });
    },
  });

  const handleAddBlog = () => {
    setSelectedBlog(null);
    setBlogDialogOpen(true);
  };

  const handleEditBlog = (blog: Blog) => {
    setSelectedBlog(blog);
    setBlogDialogOpen(true);
  };

  const handleDeleteBlog = (blog: Blog) => {
    setSelectedBlog(blog);
    setDeleteDialogOpen(true);
  };

  const handleSaveBlog = (blog: Partial<Blog> & { imageFile?: File }) => {
    blogMutation.mutate(blog);
  };

  const handleConfirmDelete = () => {
    if (selectedBlog) {
      deleteMutation.mutate(selectedBlog.id);
    }
  };

  const handleTogglePublish = (blog: Blog) => {
    togglePublishMutation.mutate({
      id: blog.id,
      published: !blog.published,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Blogs Management</h2>
        <p className="text-muted-foreground">
          Create and manage blog posts and articles
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Blogs ({blogs.length})
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="blog-admin-search"
                  name="search"
                  placeholder="Search blogs..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleAddBlog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Blog
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">Loading blog posts...</div>
          ) : blogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No blogs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Blog Post</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogs.map((blog) => (
                    <TableRow key={blog.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {blog.image && (
                            <img
                              src={blog.image}
                              alt={blog.title}
                              loading="lazy"
                              className="w-16 h-16 rounded object-cover"
                            />
                          )}
                          <div className="max-w-md">
                            <p className="font-medium line-clamp-1">
                              {blog.title}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {blog.excerpt}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{blog.author}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(blog.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={blog.published ? "default" : "secondary"}
                        >
                          {blog.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePublish(blog)}
                            title={blog.published ? "Unpublish" : "Publish"}
                          >
                            {blog.published ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditBlog(blog)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBlog(blog)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 0 && (
        <div className="flex flex-col items-center gap-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage(page - 1);
                  }}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {/* Show only logical range of pages if many pages exist, otherwise all */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={page === p}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(p);
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) setPage(page + 1);
                  }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
        </div>
      )}

      <BlogDialog
        open={blogDialogOpen}
        onOpenChange={setBlogDialogOpen}
        blog={selectedBlog}
        onSave={handleSaveBlog}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Blog"
        description={`Are you sure you want to delete "${selectedBlog?.title}"? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
