import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import { AboutCard } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AboutCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: AboutCard | null;
}

const iconOptions = [
  "Target",
  "Eye",
  "Heart",
  "Flag",
  "Star",
  "Award",
  "TrendingUp",
  "Users",
];

export default function AboutCardDialog({
  open,
  onOpenChange,
  card,
}: AboutCardDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Target");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description);
      setIcon(card.icon);
      setOrder(card.order);
    } else {
      setTitle("");
      setDescription("");
      setIcon("Target");
      setOrder(1);
    }
  }, [card, open]);

  const addMutation = useMutation({
    mutationFn: (newCard: Omit<AboutCard, "id">) =>
      aboutService.createCard(newCard),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Card added successfully" });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to add card",
        description: getErrorMessage(error, "Failed to add card"),
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
      updates: Partial<Omit<AboutCard, "id">>;
    }) => aboutService.updateCard(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Card updated successfully" });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to update card",
        description: getErrorMessage(error, "Failed to update card"),
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

    const cardData = {
      title: title.trim(),
      description: description.trim(),
      icon,
      order,
    };

    if (card) {
      updateMutation.mutate({ id: card.id, updates: cardData });
    } else {
      addMutation.mutate(cardData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {card ? "Edit Card" : "Add New Card"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Card Details</h3>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Our Mission"
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
                  placeholder="Enter card description..."
                  rows={4}
                  required
                />
              </div>
            </div>

            {/* Display Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Display Settings</h3>

              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger id="icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((iconName) => (
                      <SelectItem key={iconName} value={iconName}>
                        {iconName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                {card ? "Update" : "Add"} Card
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
