import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { testimonialService } from "@/services/testimonial.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";

export function TestimonialForm() {
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [role, setRole] = useState("");
  const [content, setContent] = useState("");

  const createTestimonialMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      name: string;
      email?: string;
      role: string;
      content: string;
      rating: number;
      image?: string;
    }) => {
      return testimonialService.create(data);
    },
    onSuccess: () => {
      toast({
        title: "Thank you!",
        description: "Your testimonial has been submitted successfully.",
      });
      // Reset form
      setRole("");
      setContent("");
      setRating(5);
      // Invalidate testimonials query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["testimonials"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to submit testimonial. Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit a testimonial.",
        variant: "destructive",
      });
      return;
    }

    if (!role.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your role or what you do.",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Missing Information",
        description: "Please write your testimonial.",
        variant: "destructive",
      });
      return;
    }

    if (content.trim().length < 150) {
      toast({
        title: "Too Short",
        description: "Please write at least 150 characters.",
        variant: "destructive",
      });
      return;
    }

    createTestimonialMutation.mutate({
      user_id: user.id,
      name: user.name || user.firstName || user.email.split("@")[0],
      email: user.email,
      role: role.trim(),
      content: content.trim(),
      rating,
      image: user.image || undefined,
    });
  };

  if (!isAuthenticated) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Share Your Experience</CardTitle>
          <CardDescription>
            Please log in to share your testimonial with us.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Sign in to your account to let us know what you think about our
            services.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Share Your Experience</CardTitle>
        <CardDescription>
          Tell us what you think about our organization and help others learn
          about our work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name (Read-only, from user profile) */}
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              value={user?.name || user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">From your profile</p>
          </div>

          {/* Role/Title */}
          <div className="space-y-2">
            <Label htmlFor="role">
              Your Role or Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role"
              placeholder="e.g., Regular Customer, Event Participant, Volunteer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground">
              How are you associated with us?
            </p>
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <Label>
              Rating <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-all hover:scale-125 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 rounded"
                >
                  <Star
                    className={`h-9 w-9 ${star <= (hoveredRating || rating)
                      ? "fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                      : "text-[#D4AF37]/20"
                      }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {rating} {rating === 1 ? "star" : "stars"}
              </span>
            </div>
          </div>

          {/* Testimonial Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              Your Testimonial <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              placeholder="Share your experience with us... What did you like? How did we help you?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              maxLength={500}
              required
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Minimum 150 characters</span>
              <span>{content.length}/500 characters</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRole("");
                setContent("");
                setRating(5);
              }}
              disabled={createTestimonialMutation.isPending}
            >
              Clear
            </Button>
            <Button
              type="submit"
              disabled={createTestimonialMutation.isPending}
            >
              {createTestimonialMutation.isPending
                ? "Submitting..."
                : "Submit Testimonial"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
