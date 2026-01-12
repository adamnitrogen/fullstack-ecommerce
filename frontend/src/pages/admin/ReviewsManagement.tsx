import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewService } from "@/services/review.service";
import { Review } from "@/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Search, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
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
import { Badge } from "@/components/ui/badge";

export default function ReviewsManagement() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const limit = 10;

    const { data, isLoading } = useQuery({
        queryKey: ["all-reviews", page],
        queryFn: () => reviewService.getAllReviews(page, limit),
    });

    const reviews = data?.reviews || [];
    const totalPages = data?.totalPages || 1;

    const deleteMutation = useMutation({
        mutationFn: reviewService.deleteReview,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
            toast({
                title: "Success",
                description: "Review deleted successfully",
            });
            setDeleteId(null);
        },
        onError: (error: unknown) => {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to delete review"),
                variant: "destructive",
            });
        },
    });

    const filteredReviews = reviews.filter(
        (review: Review) =>
            review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            review.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
            review.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (review.productName && review.productName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading) {
        return <div>Loading reviews...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Reviews Management</h2>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="review-search"
                        name="search"
                        placeholder="Search reviews..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Review</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredReviews.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    No reviews found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredReviews.map((review: Review) => (
                                <TableRow key={review.id}>
                                    <TableCell className="font-medium">
                                        {review.productName || "Unknown Product"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{review.userName}</span>
                                            {review.verified && (
                                                <Badge variant="secondary" className="w-fit text-[10px] px-1 py-0">Verified</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Star className="h-4 w-4 fill-accent text-accent" />
                                            <span>{review.rating}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                        <div className="font-medium truncate">{review.title}</div>
                                        <div className="text-sm text-muted-foreground truncate">
                                            {review.comment}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(review.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteId(review.id)}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                >
                    Previous
                </Button>
                <div className="text-sm font-medium">
                    Page {page} of {totalPages}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                >
                    Next
                </Button>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the review.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
