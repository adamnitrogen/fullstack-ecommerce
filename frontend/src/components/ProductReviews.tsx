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

  if (reviews.length === 0 && !showForm) {
    return (
      <div className="pt-8">
        <div className="text-center py-12 rounded-[2rem] border-2 border-dashed border-[#B85C3C]/10 bg-white/50">
          <h3 className="font-playfair text-2xl font-bold text-[#2C1810] mb-2">No Reviews Yet</h3>
          <p className="text-xs text-muted-foreground font-medium mb-6">Be the first to share your experience</p>
          <Button
            onClick={() => isAuthenticated ? setShowForm(true) : setAuthDialogOpen(true)}
            className="rounded-full px-8 py-4 text-xs font-bold bg-[#B85C3C] hover:bg-[#2C1810] shadow-lg shadow-[#B85C3C]/10 h-auto transition-all"
          >
            Write a Review
          </Button>
        </div>
        <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-2xl font-bold text-[#2C1810] font-playfair">Guest Reviews</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-8">
          {/* Rating Summary */}
          {reviews.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#FAF7F2]/50 p-6 rounded-2xl border border-[#B85C3C]/5">
              <div className="text-center md:text-left space-y-1">
                <div className="text-5xl font-black text-[#2C1810]">
                  {averageRating.toFixed(1)}
                </div>
                <div className="flex items-center justify-center md:justify-start gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < Math.floor(averageRating) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-muted"}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">
                  Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                </p>
              </div>

              <div className="space-y-2">
                {ratingDistribution.map(({ stars, count, percentage }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="text-[9px] font-bold w-8 text-muted-foreground uppercase">{stars} Str</span>
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#B85C3C] rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground w-4 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Write Review Button */}
          {!showForm && reviews.length > 0 && (
            <div className="flex justify-start">
              <Button
                onClick={() => isAuthenticated ? setShowForm(true) : setAuthDialogOpen(true)}
                variant="outline"
                className="rounded-full px-8 py-3 text-xs font-bold border-[#B85C3C]/20 text-[#B85C3C] hover:bg-[#FAF7F2] h-auto transition-all"
              >
                Share Your Experience
              </Button>
            </div>
          )}

          {/* Review Form */}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="space-y-6 p-8 rounded-2xl bg-[#FAF7F2] border border-[#B85C3C]/10 animate-in zoom-in-95 duration-300"
            >
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#2C1810] font-playfair">Write a Review</h3>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Your feedback honors our tradition</p>
              </div>

              <div className="space-y-4">
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
                        size={24}
                        className={star <= (hoveredRating || rating) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-muted"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">Title</label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Exceptional quality"
                    className="bg-white rounded-xl border-none shadow-sm h-10 text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">Posting As</label>
                  <div className="h-10 flex items-center px-4 bg-white/50 rounded-xl border border-dashed border-[#B85C3C]/20 text-xs font-bold text-[#2C1810]">
                    {user?.name}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="comment" className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">Comment</label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  placeholder="Share your thoughts..."
                  className="bg-white rounded-xl border-none shadow-sm p-4 min-h-[100px] text-sm resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createReviewMutation.isPending}
                  className="rounded-full px-8 py-3 text-xs font-bold bg-[#B85C3C] hover:bg-[#2C1810] h-auto shadow-md"
                >
                  {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  className="rounded-full px-8 py-3 text-xs font-bold text-muted-foreground h-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Reviews List */}
          {reviews.length > 0 && (
            <div className="space-y-6">
              <Separator className="bg-[#B85C3C]/5" />
              <div className="grid gap-6">
                {displayedReviews.map((review) => (
                  <div key={review.id} className="group animate-in fade-in duration-500">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-xl bg-[#FAF7F2] border border-[#B85C3C]/5 flex items-center justify-center text-[#B85C3C] font-black text-xs flex-shrink-0">
                        {review.userAvatar ? (
                          <img src={review.userAvatar} alt={review.userName} className="h-full w-full rounded-xl object-cover" />
                        ) : (
                          review.userName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2C1810] text-xs">{review.userName}</span>
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  size={10}
                                  className={i < review.rating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-muted"}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                            {new Date(review.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-[#2C1810] font-playfair">{review.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed font-light">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                    <Separator className="mt-6 bg-[#B85C3C]/5 group-last:hidden" />
                  </div>
                ))}
              </div>

              {hasMoreReviews && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="ghost"
                    onClick={loadMoreReviews}
                    className="text-[10px] font-bold text-[#B85C3C] hover:bg-[#FAF7F2] rounded-full px-6"
                  >
                    Load More Reviews
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};
