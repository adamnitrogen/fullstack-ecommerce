import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Edit, Trash2, MapPin, Plus } from "lucide-react";
import { EventDialog } from "@/components/admin/EventDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import type { Event } from "@/types";
import { format } from "date-fns";

export default function EventsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-events", searchQuery, page],
    queryFn: async () => {
      const { eventService } = await import("@/services/event.service");
      return eventService.getAll({ page, limit: 15, search: searchQuery });
    },
  });

  const eventMutation = useMutation({
    mutationFn: async (eventData: Partial<Event> & { imageFile?: File }) => {
      const { eventService } = await import("@/services/event.service");

      const finalEvent = { ...eventData };

      // Handle image upload if file is present
      if (eventData.imageFile) {
        const { uploadService } = await import("@/services/upload.service");
        const response = await uploadService.uploadImage(eventData.imageFile, 'event');
        finalEvent.image = response.url;
        // Remove imageFile from the object sent to API
        delete finalEvent.imageFile;
      }

      if (finalEvent.id) {
        return eventService.update(finalEvent.id, finalEvent);
      } else {
        return eventService.create(finalEvent as Omit<Event, "id">);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({
        title: "Success",
        description: selectedEvent
          ? "Event updated successfully"
          : "Event created successfully",
      });
      setEventDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to save event"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { eventService } = await import("@/services/event.service");
      return eventService.delete(eventId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete event"),
        variant: "destructive",
      });
    },
  });

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setEventDialogOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
  };

  const handleDeleteEvent = (event: Event) => {
    setSelectedEvent(event);
    setDeleteDialogOpen(true);
  };

  const handleSaveEvent = (event: Partial<Event> & { imageFile?: File }) => {
    eventMutation.mutate(event);
  };

  const handleConfirmDelete = () => {
    if (selectedEvent) {
      deleteMutation.mutate(selectedEvent.id);
    }
  };

  const getStatusBadgeVariant = (status: Event["status"]): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      upcoming: "default",
      ongoing: "default",
      completed: "secondary",
    };
    return variants[status];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Events Management</h2>
        <p className="text-muted-foreground">
          Manage events, workshops, and ceremonies
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              All Events ({data?.total || 0})
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="event-search"
                  name="search"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1); // Reset page on search
                  }}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleAddEvent}>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">Loading...</div>
          ) : !data?.events || data.events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No events found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={event.image || '/placeholder-image.jpg'}
                              alt={event.title}
                              loading="lazy"
                              className="w-12 h-12 rounded object-cover"
                            />
                            <div>
                              <p className="font-medium">{event.title}</p>
                              <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                                {event.description}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">
                              {format(new Date(event.startDate), "MMM dd, yyyy")}
                            </p>
                            {event.endDate &&
                              event.endDate !== event.startDate && (
                                <p className="text-muted-foreground text-xs">
                                  to {format(new Date(event.endDate), "MMM dd, yyyy")}
                                </p>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="line-clamp-1 max-w-[150px]">
                              {event.location.address}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(event.status)}>
                            {event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditEvent(event)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEvent(event)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, data.total)} of {data.total} events
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 15 >= data.total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={selectedEvent}
        onSave={handleSaveEvent}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Event"
        description={`Are you sure you want to delete "${selectedEvent?.title}"? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
