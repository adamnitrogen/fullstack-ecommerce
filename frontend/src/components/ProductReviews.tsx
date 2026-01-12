import { useState } from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Review } from "@/types";
import { reviewService } from "@/services/review.service";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useAuthStore } from "@/store/authStore";
import AuthPage from "@/pages/Auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errorUtils";

interface ProductReviewsProps {
  productId: string;
}

const reviewSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title must be less than 100 characters"),
  comment: z
    .string()
    .trim()
    .min(10, "Review must be at least 10 characters")
    .max(1000, "Review must be less than 1000 characters"),
  rating: z.number().min(1, "Please select a rating").max(5),
});

export const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [displayCount, setDisplayCount] = useState(5);
  const [formData, setFormData] = useState({
    title: "",
    comment: "",
  });

  // Fetch reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => reviewService.getProductReviews(productId),
  });

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: reviewService.createReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      setFormData({ title: "", comment: "" });
      setRating(0);
      setShowForm(false);
      toast({
        title: "Success",
        description: "Review submitted successfully!",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to submit review"),
        variant: "destructive",
      });
    },
  });

  const reviewsPerPage = 5;

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0;

  const displayedReviews = reviews.slice(0, displayCount);
  const hasMoreReviews = reviews.length > displayCount;

  const loadMoreReviews = () => {
    setDisplayCount((prev) => prev + reviewsPerPage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.name || user.name.trim() === "") {
      toast({
        title: "Name Required",
        description: "Please add your name in profile settings before submitting a review.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.email || user.email.trim() === "") {
      toast({
        title: "Email Required",
        description: "Please add your email address in profile settings before submitting a review.",
        variant: "destructive",
      });
      return;
    }

    try {
      const validatedData = reviewSchema.parse({
        ...formData,
        rating,
      });

      if (!user.id) {
        toast({
          title: "Error",
          description: "User ID not found. Please log in again.",
          variant: "destructive",
        });
        return;
      }

      createReviewMutation.mutate({
        productId,
        userId: user.id,
        rating: validatedData.rating,
        title: validatedData.title,
        comment: validatedData.comment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
    }
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
    percentage:
      reviews.length > 0
        ? (reviews.filter((r) => r.rating === stars).length / reviews.length) *
        100
        : 0,
  }));

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Customer Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rating Summary - Only show if there are reviews */}
          {reviews.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="text-center md:text-left">
                  <div className="text-5xl font-bold mb-2">
                    {averageRating.toFixed(1)}
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-6 w-6 ${i < Math.floor(averageRating)
                          ? "fill-accent text-accent"
                          : "text-muted"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground">
                    Based on {reviews.length}{" "}
                    {reviews.length === 1 ? "review" : "reviews"}
                  </p>
                </div>

                <div className="space-y-2">
                  {ratingDistribution.map(({ stars, count, percentage }) => (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="text-sm font-medium w-12">{stars} star</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Write Review Button */}
          {!showForm && (
            <Button
              onClick={() => {
                if (!isAuthenticated) {
                  setAuthDialogOpen(true);
                } else {
                  setShowForm(true);
                }
              }}
              className="w-full md:w-auto"
            >
              Write a Review
            </Button>
          )}

          {/* Review Form */}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 border border-border rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold">Write Your Review</h3>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Rating *
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${star <= (hoveredRating || rating)
                          ? "fill-accent text-accent"
                          : "text-muted"
                          }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Posting as:{" "}
                  <span className="font-semibold text-foreground">
                    {user?.name}
                  </span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium mb-2"
                >
                  Review Title *
                </label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Summarize your experience"
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <label
                  htmlFor="comment"
                  className="block text-sm font-medium mb-2"
                >
                  Your Review *
                </label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) =>
                    setFormData({ ...formData, comment: e.target.value })
                  }
                  placeholder="Share your thoughts about this product"
                  required
                  rows={4}
                  maxLength={1000}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.comment.length}/1000 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createReviewMutation.isPending}>
                  {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ title: "", comment: "" });
                    setRating(0);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-8 animate-fade-in">
              <Separator />
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">
                  {reviews.length} {reviews.length === 1 ? "Review" : "Reviews"}
                </h3>
              </div>

              <div className="space-y-6">
                {displayedReviews.map((review) => (
                  <div key={review.id} className="group animate-slide-up">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-lg">
                        {review.userAvatar ? (
                          <img
                            src={review.userAvatar}
                            alt={review.userName}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          review.userName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header: Name, Date, Badge */}
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {review.userName}
                            </span>
                            {review.verified && (
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                                Verified Purchase
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {new Date(review.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>

                        {/* Rating stars */}
                        <div className="flex mb-3">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < review.rating
                                ? "fill-accent text-accent"
                                : "text-muted-foreground/20"
                                }`}
                            />
                          ))}
                        </div>

                        {/* Content */}
                        <h4 className="font-semibold text-base mb-1.5">
                          {review.title}
                        </h4>
                        <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                          {review.comment}
                        </p>
                      </div>
                    </div>
                    <Separator className="mt-6 group-last:hidden" />
                  </div>
                ))}
              </div>

              {hasMoreReviews && (
                <div className="flex flex-col items-center justify-center pt-6 gap-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    Showing {displayCount} of {reviews.length} reviews
                  </p>
                  <Button
                    variant="outline"
                    onClick={loadMoreReviews}
                    className="min-w-[200px] gap-2 hover:bg-primary/5 border-primary/20 text-primary"
                  >
                    Load More Reviews
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-border/60">
              <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <Star className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No reviews yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Be the first to share your thoughts on this product!
              </p>
              {!showForm && (
                <Button
                  onClick={() => isAuthenticated ? setShowForm(true) : setAuthDialogOpen(true)}
                  variant="secondary"
                >
                  Write First Review
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};
