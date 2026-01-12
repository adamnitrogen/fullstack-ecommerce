import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import { ImpactStat } from "@/types";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImpactStatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stat?: ImpactStat | null;
}

const iconOptions = [
  "TrendingUp",
  "Users",
  "Heart",
  "Award",
  "Star",
  "Target",
  "Shield",
  "Zap",
];

export default function ImpactStatDialog({
  open,
  onOpenChange,
  stat,
}: ImpactStatDialogProps) {
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("TrendingUp");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (stat) {
      setValue(stat.value);
      setLabel(stat.label);
      setIcon(stat.icon);
      setOrder(stat.order);
    } else {
      setValue("");
      setLabel("");
      setIcon("TrendingUp");
      setOrder(1);
    }
  }, [stat, open]);

  const createMutation = useMutation({
    mutationFn: (newStat: Omit<ImpactStat, "id">) =>
      aboutService.createStat(newStat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Impact stat added successfully" });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to add impact stat",
        description: getErrorMessage(error, "Failed to add impact stat"),
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
      updates: Partial<Omit<ImpactStat, "id">>;
    }) => aboutService.updateStat(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Impact stat updated successfully" });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to update impact stat",
        description: getErrorMessage(error, "Failed to update impact stat"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!value.trim() || !label.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const statData = {
      value: value.trim(),
      label: label.trim(),
      icon,
      order,
    };

    if (stat) {
      updateMutation.mutate({ id: stat.id, updates: statData });
    } else {
      createMutation.mutate(statData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {stat ? "Edit Impact Statistic" : "Add New Impact Statistic"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Statistic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Statistic Details</h3>

              <div className="space-y-2">
                <Label htmlFor="value">
                  Value <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g., 500+ or ₹1Cr+"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">
                  Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Cows Rescued"
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
                <Label htmlFor="order">Display Order (1-4)</Label>
                <Input
                  id="order"
                  type="number"
                  min="1"
                  max="4"
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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {stat ? "Update" : "Add"} Statistic
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
