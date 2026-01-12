import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blogCommentService } from "@/services/blog-comment.service";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Flag, CheckCircle, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Comment } from "@/types";


export default function FlaggedCommentsManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [actionType, setActionType] = useState<"dismiss" | "delete" | "block" | "unblock" | null>(null);

  const { data: flaggedComments = [], isLoading } = useQuery({
    queryKey: ["flagged-comments"],
    queryFn: blogCommentService.getFlaggedComments,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "dismiss" | "delete" }) =>
      blogCommentService.resolveFlaggedComment(id, action, user?.id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
      toast({
        title: "Success",
        description: variables.action === "delete" ? "Comment deleted" : "Flag dismissed",
      });
      setActionType(null);
      setSelectedComment(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to resolve flag"),
        variant: "destructive",
      });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/users/${userId}/block`, { isBlocked: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
      toast({
        title: "Success",
        description: "User blocked successfully",
      });
      setActionType(null);
      setSelectedComment(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to block user"),
        variant: "destructive",
      });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/users/${userId}/block`, { isBlocked: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
      toast({
        title: "Success",
        description: "User unblocked successfully",
      });
      setActionType(null);
      setSelectedComment(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to unblock user"),
        variant: "destructive",
      });
    },
  });

  const filteredComments = flaggedComments.filter(
    (comment) =>
      comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comment.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comment.blogTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = () => {
    if (selectedComment && actionType) {
      if (actionType === "block") {
        blockUserMutation.mutate(selectedComment.userId);
      } else if (actionType === "unblock") {
        unblockUserMutation.mutate(selectedComment.userId);
      } else {
        resolveMutation.mutate({ id: selectedComment.id, action: actionType });
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flagged Comments</h1>
          <p className="text-muted-foreground">
            Review and moderate flagged comments from blog posts.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flagged Comments</CardTitle>
          <CardDescription>
            A list of all comments that have been flagged by users.
          </CardDescription>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="comment-search"
                name="search"
                placeholder="Search comments..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Blog Post</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Flagged By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading flagged comments...
                  </TableCell>
                </TableRow>
              ) : filteredComments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No flagged comments found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredComments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.userAvatar} />
                          <AvatarFallback>{getInitials(comment.userName)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{comment.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate" title={comment.content}>
                        {comment.content}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate" title={comment.blogTitle}>
                        {comment.blogTitle}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        {comment.flagReason}
                      </Badge>
                    </TableCell>
                    <TableCell>{comment.flaggedBy}</TableCell>
                    <TableCell>
                      {format(new Date(comment.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => {
                            setSelectedComment(comment);
                            setActionType("dismiss");
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedComment(comment);
                            setActionType("delete");
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                        {comment.userBlocked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => {
                              setSelectedComment(comment);
                              setActionType("unblock");
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Unblock User
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setSelectedComment(comment);
                              setActionType("block");
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Block User
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedComment} onOpenChange={() => setSelectedComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "delete" ? "Delete Comment" : actionType === "block" ? "Block User" : actionType === "unblock" ? "Unblock User" : "Dismiss Flag"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "delete" ? (
                <>
                  Are you sure you want to delete this comment? This action cannot be undone.
                  <div className="mt-4 p-4 bg-muted rounded-md text-sm italic">
                    "{selectedComment?.content}"
                  </div>
                </>
              ) : actionType === "block" ? (
                <>
                  Are you sure you want to block <strong>{selectedComment?.userName}</strong>? They will no longer be able to log in or comment.
                </>
              ) : (
                "Are you sure you want to dismiss this flag? The comment will remain visible."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={actionType === "delete" || actionType === "block" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {actionType === "delete" ? "Delete" : actionType === "block" ? "Block User" : actionType === "unblock" ? "Unblock User" : "Dismiss"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
