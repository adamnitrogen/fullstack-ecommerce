import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { CalendarIcon, Plus, Check, X, AlertCircle } from "lucide-react";
import { format, isAfter, isBefore, isEqual } from "date-fns";
import { hi, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "./ImageUpload";
import type { Event } from "@/types";
import { categoryService } from "@/services/category.service";
import { uploadService } from "@/services/upload.service";
import { toast } from "../ui/use-toast";

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
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === "hi" ? hi : enUS;
  const [formData, setFormData] = useState<Partial<Event> & { imageFile?: File }>({
    title: "",
    description: "",
    location: { address: "" },
    registrationAmount: 0,
    gstRate: 0,
    keyHighlights: [],
    specialPrivileges: [],
    status: "upcoming",
    startTime: "",
    endTime: "",
  });
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [registrationDeadline, setRegistrationDeadline] = useState<Date | undefined>();
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
        startTime: event?.startTime || "",
        endTime: event?.endTime || "",
      });
      setStartDate(event.startDate ? new Date(event.startDate) : undefined);
      setEndDate(event.endDate ? new Date(event.endDate) : undefined);
      setRegistrationDeadline(event.registrationDeadline ? new Date(event.registrationDeadline) : undefined);
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
        startTime: "",
        endTime: "",
      });
      setStartDate(undefined);
      setEndDate(undefined);
      setRegistrationDeadline(undefined);
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
      toast({
        title: t("common.checkInfo"),
        description: t("events.fillRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!startDate) {
      toast({
        title: t("admin.events.dialogs.pickDate"),
        description: t("admin.events.dialogs.pickDate"),
        variant: "destructive",
      });
      return;
    }

    // Check for either existing image URL or new image file
    if (!formData.image?.trim() && !formData.imageFile) {
      toast({
        title: t("common.error"),
        description: t("events.registration.noImage"),
        variant: "destructive",
      });
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

    // RESTART LOGIC: If editing a cancelled event, reset its status and clear cancellation info
    const restartUpdates = event?.status === 'cancelled' ? {
      cancellationStatus: null,
      cancelledAt: null,
      cancellationReason: null,
      cancellationCorrelationId: null
    } : {};

    onSave({
      ...formData,
      ...restartUpdates,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString(),
      registrationDeadline: registrationDeadline ? registrationDeadline.toISOString() : undefined,
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
            {event ? t("admin.events.dialogs.editEvent") : t("admin.events.dialogs.addEvent")}
          </DialogTitle>
          <DialogDescription>
            {event
              ? t("admin.events.dialogs.editEventDesc")
              : t("admin.events.dialogs.addEventDesc")}
          </DialogDescription>
          {event?.status === 'cancelled' && (
            <div className="mt-2 p-3 bg-orange-50 border border-orange-100 rounded-lg flex items-start gap-2 text-xs text-orange-800 font-medium">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{t("admin.events.dialogs.restartNotice")}</span>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Image */}
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="text-base font-semibold">{t("admin.events.dialogs.imageLabel")}</Label>
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
                {t("admin.events.dialogs.basicInfo")}
              </h3>

              <div className="space-y-2">
                <Label htmlFor="title">
                  {t("admin.events.dialogs.eventTitle")} <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder={t("admin.events.dialogs.titlePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  {t("admin.events.dialogs.description")} <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder={t("admin.events.dialogs.descPlaceholder")}
                  rows={5}
                  required
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">
                  {t("admin.events.dialogs.location")} <span className="text-red-600">*</span>
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
                  placeholder={t("admin.events.dialogs.locationPlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t("admin.events.dialogs.category")}</Label>
                <Select
                  value={formData.category || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.events.dialogs.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.none")}</SelectItem>
                    {eventCategories.length === 0 ? (
                      <SelectItem value="no-categories" disabled>
                        {t("admin.events.dialogs.noCategories")}
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
                  {t("admin.events.dialogs.adminOnly")}
                </p>
              </div>
            </div>

            {/* Event Dates & Status */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {t("admin.events.dialogs.schedule")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {t("admin.events.dialogs.startDate")} <span className="text-red-600">*</span>
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
                          format(startDate, "PPP", { locale: currentLocale })
                        ) : (
                          <span>{t("admin.events.dialogs.pickDate")}</span>
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
                  <Label>{t("admin.events.dialogs.endDate")} ({t("common.optional")})</Label>
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
                          format(endDate, "PPP", { locale: currentLocale })
                        ) : (
                          <span>{t("admin.events.dialogs.pickDate")}</span>
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

                <div className="space-y-2">
                  <Label>{t("admin.events.dialogs.startTime")}</Label>
                  <Input
                    type="time"
                    value={formData.startTime || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.events.dialogs.endTime")}</Label>
                  <Input
                    type="time"
                    value={formData.endTime || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>{t("admin.events.dialogs.deadline")} ({t("common.optional")})</Label>
                    {registrationDeadline && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setRegistrationDeadline(undefined)}
                        type="button"
                      >
                        {t("common.clear")}
                      </Button>
                    )}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !registrationDeadline && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {registrationDeadline ? (
                          format(registrationDeadline, "PPP", { locale: currentLocale })
                        ) : (
                          <span>{t("admin.events.dialogs.pickDate")}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={registrationDeadline}
                        onSelect={setRegistrationDeadline}
                        initialFocus
                        disabled={(date) =>
                          startDate ? date > startDate : false
                        }
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-muted-foreground italic">
                    {t("admin.events.dialogs.deadlineHelp")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.events.dialogs.statusLabel")}</Label>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={getStatusBadgeVariant(
                        formData.status || "upcoming"
                      )}
                      className="capitalize"
                    >
                      {t(`events.${formData.status || "upcoming"}`)}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {t("admin.events.dialogs.statusDescription")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Capacity & Registration */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {t("admin.events.management.allEvents")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="capacity">{t("admin.events.dialogs.capacity")}</Label>
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
                    placeholder={t("admin.events.dialogs.capacityPlaceholder")}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="registrationAmount">{t("admin.events.dialogs.feeLabel")}</Label>
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
                        onChange={(e) => {
                          const amount = parseInt(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            registrationAmount: amount,
                          });
                        }}
                        placeholder={t("common.none")}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  {formData.registrationAmount !== undefined && formData.registrationAmount > 0 && (
                    <div className="space-y-4 pt-2 border-t mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="gstRate">{t("events.registration.gst")}</Label>
                        <Select
                          value={String(formData.gstRate || 0)}
                          onValueChange={(value) =>
                            setFormData({ ...formData, gstRate: parseInt(value) })
                          }
                        >
                          <SelectTrigger id="gstRate">
                            <SelectValue placeholder={t("admin.events.dialogs.selectCategory")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% ({t("common.none")})</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-md space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("events.registration.basePrice")}:</span>
                          <span className="font-medium">
                            ₹{(formData.registrationAmount / (1 + (formData.gstRate || 0) / 100)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("events.registration.gst")} ({formData.gstRate || 0}%):</span>
                          <span className="font-medium">
                            ₹{(formData.registrationAmount - (formData.registrationAmount / (1 + (formData.gstRate || 0) / 100))).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-muted-foreground/20 pt-1 mt-1">
                          <span className="font-semibold text-primary">{t("events.registration.total")}:</span>
                          <span className="font-bold text-primary">₹{(formData.registrationAmount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    {formData.registrationAmount === 0
                      ? t("events.public.details.entryFree")
                      : `₹${formData.registrationAmount} ${t("events.public.details.taxInclusive")}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Key Highlights */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {t("admin.events.dialogs.highlightsLabel")}
              </h3>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    placeholder={t("admin.events.dialogs.highlightsLabel")}
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
                {t("admin.events.dialogs.privilegesLabel")}
              </h3>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={privilegeInput}
                    onChange={(e) => setPrivilegeInput(e.target.value)}
                    placeholder={t("admin.events.dialogs.privilegesLabel")}
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
                {t("common.cancel")}
              </Button>
              <Button type="submit">
                {event ? t("common.update") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
