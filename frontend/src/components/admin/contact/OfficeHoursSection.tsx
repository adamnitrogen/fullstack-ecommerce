import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Copy, Loader2 } from "lucide-react";
import { OfficeHour } from "@/services/contact-info.service";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";

interface OfficeHoursSectionProps {
  officeHours: OfficeHour[];
  onUpdate: (officeHours: OfficeHour[]) => Promise<void>;
}

export function OfficeHoursSection({
  officeHours,
  onUpdate,
}: OfficeHoursSectionProps) {
  const [localHours, setLocalHours] = useState<OfficeHour[]>(officeHours);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [bulkOpenTime, setBulkOpenTime] = useState("09:00");
  const [bulkCloseTime, setBulkCloseTime] = useState("17:00");
  const [bulkClosed, setBulkClosed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalHours(officeHours);
  }, [officeHours]);

  const handleUpdate = (id: string, updates: Partial<OfficeHour>) => {
    setLocalHours((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  };

  const toggleDaySelection = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const applyToSelected = () => {
    if (selectedDays.length === 0) {
      toast.error("Please select at least one day");
      return;
    }

    setLocalHours((prev) =>
      prev.map((h) =>
        selectedDays.includes(h.day_of_week)
          ? {
            ...h,
            open_time: bulkOpenTime,
            close_time: bulkCloseTime,
            is_closed: bulkClosed,
          }
          : h
      )
    );
    setSelectedDays([]);
    toast.success(
      `Applied to ${selectedDays.length} day${selectedDays.length > 1 ? "s" : ""
      }`
    );
  };

  const selectAllDays = () => {
    if (selectedDays.length === localHours.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays(localHours.map((h) => h.day_of_week));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(localHours);
      toast.success("Office hours updated");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update office hours"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Office Hours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bulk Edit Section */}
        <div className="border-2 border-dashed rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Apply to Multiple Days</h3>
            <Button variant="outline" size="sm" onClick={selectAllDays}>
              {selectedDays.length === localHours.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>

          {/* Day Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {localHours.map((hours) => (
              <div
                key={hours.id}
                className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50"
              >
                <Checkbox
                  id={`select-${hours.id}`}
                  checked={selectedDays.includes(hours.day_of_week)}
                  onCheckedChange={() => toggleDaySelection(hours.day_of_week)}
                />
                <Label
                  htmlFor={`select-${hours.id}`}
                  className="cursor-pointer font-medium"
                >
                  {hours.day_of_week}
                </Label>
              </div>
            ))}
          </div>

          {/* Bulk Settings */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Switch
                id="bulk-closed"
                checked={bulkClosed}
                onCheckedChange={setBulkClosed}
              />
              <Label htmlFor="bulk-closed" className="font-medium">
                Mark as Closed
              </Label>
            </div>

            {!bulkClosed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Open Time</Label>
                  <Input
                    type="time"
                    value={bulkOpenTime}
                    onChange={(e) => setBulkOpenTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Close Time</Label>
                  <Input
                    type="time"
                    value={bulkCloseTime}
                    onChange={(e) => setBulkCloseTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={applyToSelected}
              disabled={selectedDays.length === 0}
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              Apply to {selectedDays.length} Selected Day
              {selectedDays.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>

        {/* Individual Day Settings */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Individual Day Settings</h3>
          {localHours.map((hours) => (
            <div key={hours.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{hours.day_of_week}</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`closed-${hours.id}`}>Closed</Label>
                  <Switch
                    id={`closed-${hours.id}`}
                    checked={hours.is_closed}
                    onCheckedChange={(checked) =>
                      handleUpdate(hours.id, { is_closed: checked })
                    }
                  />
                </div>
              </div>
              {!hours.is_closed && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Open Time</Label>
                    <Input
                      type="time"
                      value={hours.open_time || ""}
                      onChange={(e) =>
                        handleUpdate(hours.id, { open_time: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Close Time</Label>
                    <Input
                      type="time"
                      value={hours.close_time || ""}
                      onChange={(e) =>
                        handleUpdate(hours.id, { close_time: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button onClick={handleSave} className="w-full" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Office Hours"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
