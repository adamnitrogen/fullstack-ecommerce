import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import { TimelineItem } from "@/types";
import { useToast } from "@/hooks/use-toast";
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

interface TimelineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: TimelineItem | null;
}

export default function TimelineItemDialog({
  open,
  onOpenChange,
  item,
}: TimelineItemDialogProps) {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (item) {
      setMonth(item.month);
      setYear(item.year);
      setTitle(item.title);
      setDescription(item.description);
      setOrder(item.order);
    } else {
      setMonth("");
      setYear("");
      setTitle("");
      setDescription("");
      setOrder(1);
    }
  }, [item, open]);

  const addMutation = useMutation({
    mutationFn: (newItem: Omit<TimelineItem, "id">) =>
      aboutService.createTimeline(newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Timeline item added successfully" });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<TimelineItem, "id">>;
    }) => aboutService.updateTimeline(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Timeline item updated successfully" });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!month.trim() || !year.trim() || !title.trim() || !description.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      month: month.trim(),
      year: year.trim(),
      title: title.trim(),
      description: description.trim(),
      order,
    };

    if (item) {
      updateMutation.mutate({ id: item.id, updates: itemData });
    } else {
      addMutation.mutate(itemData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {item ? "Edit Timeline Item" : "Add New Timeline Item"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Timeline Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Timeline Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">
                    Month <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder="e.g., January"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">
                    Year <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g., 2015"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Foundation"
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
                  placeholder="Enter timeline description..."
                  rows={3}
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
                {item ? "Update" : "Add"} Timeline Item
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
