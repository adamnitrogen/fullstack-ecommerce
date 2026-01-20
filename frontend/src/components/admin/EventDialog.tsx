import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Plus, Check, X } from "lucide-react";
import { format, isAfter, isBefore, isEqual } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "./ImageUpload";
import type { Event } from "@/types";
import { categoryService } from "@/services/category.service";
import { uploadService } from "@/services/upload.service";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
  onSave: (event: Partial<Event> & { imageFile?: File }) => void;
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  onSave,
}: EventDialogProps) {
  const [formData, setFormData] = useState<Partial<Event> & { imageFile?: File }>({
    title: "",
    description: "",
    location: { address: "" },
    registrationAmount: 0,
    keyHighlights: [],
    specialPrivileges: [],
    status: "upcoming",
  });
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [highlightInput, setHighlightInput] = useState("");
  const [privilegeInput, setPrivilegeInput] = useState("");
  const [originalImage, setOriginalImage] = useState<string | undefined>();

  const { data: eventCategories = [] } = useQuery({
    queryKey: ["event-categories"],
    queryFn: async () => {
      return categoryService.getAll("event");
    },
  });

  useEffect(() => {
    if (event) {
      // Store original image to track deletion
      setOriginalImage(event.image);

      setFormData({
        ...event,
        imageFile: undefined,
      });
      setStartDate(event.startDate ? new Date(event.startDate) : undefined);
      setEndDate(event.endDate ? new Date(event.endDate) : undefined);
    } else {
      setOriginalImage(undefined);

      setFormData({
        title: "",
        description: "",
        location: { address: "" },
        registrationAmount: 0,
        keyHighlights: [],
        specialPrivileges: [],
        status: "upcoming",
      });
      setStartDate(undefined);
      setEndDate(undefined);
    }
    setHighlightInput("");
    setPrivilegeInput("");
  }, [event, open]);

  const calculateStatus = (
    start: Date | undefined,
    end: Date | undefined
  ): Event["status"] => {
    if (!start) return "upcoming";

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfEventDay = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

    if (isBefore(startOfEventDay, startOfToday)) {
      if (end) {
        const startOfEndDay = new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate()
        );
        if (isAfter(startOfEndDay, startOfToday) || isEqual(startOfEndDay, startOfToday)) {
          return "ongoing";
        }
      }
      return "completed";
    } else if (isEqual(startOfEventDay, startOfToday)) {
      return "ongoing";
    }
    return "upcoming";
  };

  useEffect(() => {
    if (startDate) {
      const newStatus = calculateStatus(startDate, endDate);
      setFormData((prev) => ({ ...prev, status: newStatus }));
    }
  }, [startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.title?.trim() ||
      !formData.description?.trim() ||
      !formData.location?.address?.trim()
    ) {
      alert("Please fill in all required fields");
      return;
    }

    if (!startDate) {
      alert("Start date is required");
      return;
    }

    // Check for either existing image URL or new image file
    if (!formData.image?.trim() && !formData.imageFile) {
      alert("Please upload an event image");
      return;
    }

    // Delete old image if it was replaced
    if (originalImage && formData.imageFile instanceof File) {
      logger.debug("Deleting replaced image:", originalImage);
      try {
        await uploadService.deleteImageByUrl(originalImage);
        logger.debug("Successfully deleted old image:", originalImage);
      } catch (error) {
        logger.error("Failed to delete old image: " + originalImage, error);
        // Continue even if deletion fails
      }
    }

    const finalStatus = calculateStatus(startDate, endDate);

    onSave({
      ...formData,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString(),
      status: finalStatus,
      id: event?.id,
      imageFile: formData.imageFile instanceof File ? formData.imageFile : undefined,
    });
  };

  const addHighlight = () => {
    if (highlightInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        keyHighlights: [...(prev.keyHighlights || []), highlightInput.trim()],
      }));
      setHighlightInput("");
    }
  };

  const removeHighlight = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      keyHighlights: prev.keyHighlights?.filter((_, i) => i !== index) || [],
    }));
  };

  const addPrivilege = () => {
    if (privilegeInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        specialPrivileges: [
          ...(prev.specialPrivileges || []),
          privilegeInput.trim(),
        ],
      }));
      setPrivilegeInput("");
    }
  };

  const removePrivilege = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      specialPrivileges:
        prev.specialPrivileges?.filter((_, i) => i !== index) || [],
    }));
  };

  const getStatusBadgeVariant = (status: Event["status"]) => {
    switch (status) {
      case "ongoing":
        return "default";
      case "completed":
        return "secondary";
      case "upcoming":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {event ? "Edit Event" : "Add New Event"}
          </DialogTitle>
          <DialogDescription>
            {event
              ? "Update event details and registration settings"
              : "Create a new event for the community"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Image */}
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="text-base font-semibold">Event Image</Label>
              <ImageUpload
                images={
                  formData.imageFile
                    ? [formData.imageFile]
                    : formData.image
                      ? [formData.image]
                      : []
                }
                onChange={(images) => {
                  const firstImage = images[0];
                  if (firstImage instanceof File) {
                    setFormData({ ...formData, imageFile: firstImage, image: undefined });
                  } else if (typeof firstImage === 'string') {
                    setFormData({ ...formData, image: firstImage, imageFile: undefined });
                  } else {
                    setFormData({ ...formData, imageFile: undefined, image: undefined });
                  }
                }}
                maxImages={1}
                type="event"
              />
            </div>

            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Basic Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Event Title <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter event title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter detailed event description"
                  rows={5}
                  required
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">
                  Location <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="location"
                  value={formData.location?.address || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: { address: e.target.value },
                    })
                  }
                  placeholder="Enter event location address"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category (Internal Use Only)</Label>
                <Select
                  value={formData.category || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {eventCategories.length === 0 ? (
                      <SelectItem value="no-categories" disabled>
                        No categories available
                      </SelectItem>
                    ) : (
                      eventCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  For admin organization only - not visible to customers
                </p>
              </div>
            </div>

            {/* Event Dates & Status */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Event Schedule
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Start Date <span className="text-red-600">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? (
                          format(startDate, "PPP")
                        ) : (
                          <span>Pick start date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? (
                          format(endDate, "PPP")
                        ) : (
                          <span>Pick end date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        disabled={(date) =>
                          startDate ? date < startDate : false
                        }
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Event Status (Auto-calculated)</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getStatusBadgeVariant(
                      formData.status || "upcoming"
                    )}
                    className="capitalize"
                  >
                    {formData.status || "upcoming"}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Status is automatically determined based on start and end
                    dates
                  </span>
                </div>
              </div>
            </div>

            {/* Capacity & Registration */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Capacity & Registration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Event Capacity (Optional)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="0"
                    value={formData.capacity || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        capacity: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="Max participants (leave empty for unlimited)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationAmount">Registration Fee</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <Input
                      id="registrationAmount"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.registrationAmount || 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          registrationAmount: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0 for free"
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {formData.registrationAmount === 0
                      ? "Free event"
                      : `₹${formData.registrationAmount} registration fee`}
                  </p>
                </div>
              </div>
            </div>

            {/* Key Highlights */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Key Highlights
              </h3>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    placeholder="Add a key highlight"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addHighlight();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addHighlight}
                    size="icon"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {formData.keyHighlights &&
                  formData.keyHighlights.length > 0 && (
                    <div className="space-y-2">
                      {formData.keyHighlights.map((highlight, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border"
                        >
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="flex-1 text-sm">{highlight}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => removeHighlight(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Special Privileges */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Special Privileges for Devotees
              </h3>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={privilegeInput}
                    onChange={(e) => setPrivilegeInput(e.target.value)}
                    placeholder="Add a special privilege"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPrivilege();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={addPrivilege}
                    size="icon"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {formData.specialPrivileges &&
                  formData.specialPrivileges.length > 0 && (
                    <div className="space-y-2">
                      {formData.specialPrivileges.map((privilege, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border"
                        >
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="flex-1 text-sm">{privilege}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => removePrivilege(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {event ? "Update Event" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
