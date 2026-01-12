import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import { FutureGoal } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FutureGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: FutureGoal | null;
}

export default function FutureGoalDialog({
  open,
  onOpenChange,
  goal,
}: FutureGoalDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description);
      setOrder(goal.order);
    } else {
      setTitle("");
      setDescription("");
      setOrder(1);
    }
  }, [goal, open]);

  const addMutation = useMutation({
    mutationFn: (newGoal: Omit<FutureGoal, "id">) =>
      aboutService.createGoal(newGoal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Future goal added successfully" });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to add future goal",
        description: getErrorMessage(error, "Failed to add future goal"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<FutureGoal, "id">>;
    }) => aboutService.updateGoal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Future goal updated successfully" });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to update future goal",
        description: getErrorMessage(error, "Failed to update future goal"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const goalData = {
      title: title.trim(),
      description: description.trim(),
      order,
    };

    if (goal) {
      updateMutation.mutate({ id: goal.id, updates: goalData });
    } else {
      addMutation.mutate(goalData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {goal ? "Edit Future Goal" : "Add New Future Goal"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Goal Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Goal Details</h3>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Expand Capacity to 1000+ Cows"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter goal description..."
                  rows={4}
                  required
                />
              </div>
            </div>

            {/* Display Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Display Settings</h3>

              <div className="space-y-2">
                <Label htmlFor="order">Display Order</Label>
                <Input
                  id="order"
                  type="number"
                  min="1"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending || updateMutation.isPending}
              >
                {goal ? "Update" : "Add"} Future Goal
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
