import { useState, useEffect } from "react";
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
import { Calendar, Search, Edit, Trash2, MapPin, Plus, XCircle, AlertCircle, CalendarDays, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { EventCancellationDialog } from "@/components/admin/EventCancellationDialog";
import { RescheduleDialog } from "@/components/admin/RescheduleDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import type { Event, CancellationJobStatus } from "@/types";
import { format } from "date-fns";
import { EventDialog } from "@/components/admin/EventDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { eventService } from "@/services/event.service";
import { uploadService } from "@/services/upload.service";

export default function EventsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-events", searchQuery, page],
    queryFn: async () => {
      return eventService.getAll({ page, limit: 15, search: searchQuery });
    },
  });

  const eventMutation = useMutation({
    mutationFn: async (eventData: Partial<Event> & { imageFile?: File }) => {
      const finalEvent = { ...eventData };
      if (eventData.imageFile) {
        const response = await uploadService.uploadImage(eventData.imageFile, 'event');
        finalEvent.image = response.url;
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
        description: selectedEvent ? "Event updated successfully" : "Event created successfully",
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


  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return eventService.cancel(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({
        title: "Cancellation Initiated",
        description: "Event cancellation job started successfully",
      });
      setCancelDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to initiate cancellation"),
        variant: "destructive",
      });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { startDate: string; endDate?: string; reason: string } }) => {
      return eventService.updateSchedule(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({
        title: "Event Rescheduled",
        description: "Schedule updated and notifications sent to all registrants.",
      });
      setRescheduleDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to reschedule event"),
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return eventService.retryCancellation(eventId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["job-status"] });
      toast({
        title: "Retry Initiated",
        description: data.message,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Retry Failed",
        description: getErrorMessage(error, "Failed to retry cancellation"),
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

  const handleCancelEventClick = (event: Event) => {
    setSelectedEvent(event);
    setCancelDialogOpen(true);
  };

  const handleRescheduleClick = (event: Event) => {
    setSelectedEvent(event);
    setRescheduleDialogOpen(true);
  };

  const handleSaveEvent = (event: Partial<Event> & { imageFile?: File }) => {
    eventMutation.mutate(event);
  };

  const handleConfirmCancel = async (reason: string) => {
    if (selectedEvent) {
      await cancelMutation.mutateAsync({ id: selectedEvent.id, reason });
    }
  };

  const handleConfirmReschedule = async (data: { startDate: string; endDate?: string; reason: string }) => {
    if (selectedEvent) {
      await rescheduleMutation.mutateAsync({ id: selectedEvent.id, data });
    }
  };

  const getStatusBadgeVariant = (status: Event["status"]): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      upcoming: "default",
      ongoing: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return variants[status];
  };

  // Job Status Badge Component for cancelled events
  const JobStatusBadge = ({ eventId }: { eventId: string }) => {
    const { data: jobStatus } = useQuery<CancellationJobStatus | null>({
      queryKey: ["job-status", eventId],
      queryFn: async () => {
        return eventService.getJobStatus(eventId);
      },
      refetchInterval: (query) => {
        // Poll every 3 seconds if job is in progress
        const status = query.state.data?.status;
        return status === 'IN_PROGRESS' || status === 'PENDING' ? 3000 : false;
      },
    });

    // Notify on job completion if it was previously processing
    const [lastStatus, setLastStatus] = useState<string | null>(null);
    useEffect(() => {
      if (jobStatus?.status && lastStatus && lastStatus !== jobStatus.status) {
        if (jobStatus.status === 'COMPLETED') {
          toast({
            title: "Cancellation Complete",
            description: "All registrants have been processed and refunded.",
          });
          queryClient.invalidateQueries({ queryKey: ["admin-events"] });
        } else if (jobStatus.status === 'FAILED' || jobStatus.status === 'PARTIAL_FAILURE') {
          toast({
            title: "Job Warning",
            description: `Cancellation job ended with status: ${jobStatus.status}`,
            variant: "destructive",
          });
        }
      }
      if (jobStatus?.status) {
        setLastStatus(jobStatus.status);
      }
    }, [jobStatus, lastStatus]);

    if (!jobStatus) return null;

    const statusConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
      PENDING: { icon: <Loader2 className="h-3 w-3 animate-spin" />, className: "bg-blue-100 text-blue-700", label: "Pending" },
      IN_PROGRESS: { icon: <Loader2 className="h-3 w-3 animate-spin" />, className: "bg-blue-100 text-blue-700", label: "Processing" },
      COMPLETED: { icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-green-100 text-green-700", label: "Completed" },
      PARTIAL_FAILURE: { icon: <AlertTriangle className="h-3 w-3" />, className: "bg-orange-100 text-orange-700", label: "Partial" },
      FAILED: { icon: <XCircle className="h-3 w-3" />, className: "bg-red-100 text-red-700", label: "Failed" },
    };

    const config = statusConfig[jobStatus.status] || statusConfig.PENDING;
    const showRetry = ['FAILED', 'PARTIAL_FAILURE'].includes(jobStatus.status);

    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 ${config.className} border-none cursor-help`}>
                  {config.icon}
                  <span className="ml-1">{config.label}</span>
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="space-y-1">
                <p className="font-semibold">Job: {jobStatus.status}</p>
                <p>Processed: {jobStatus.processed_count || 0}/{jobStatus.total_registrations || 0}</p>
                {jobStatus.failed_count > 0 && <p className="text-red-500">Failed: {jobStatus.failed_count}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
          {showRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={() => retryMutation.mutate(eventId)}
              disabled={retryMutation.isPending}
              title="Retry failed job"
            >
              {retryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Events Management</h2>
        <p className="text-muted-foreground">Manage events, workshops, and ceremonies</p>
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
                    setPage(1);
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
            <div className="text-center py-12">Loading event records...</div>
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
                            <p className="font-medium">{format(new Date(event.startDate), "MMM dd, yyyy")}</p>
                            {event.endDate && event.endDate !== event.startDate && (
                              <p className="text-muted-foreground text-xs">to {format(new Date(event.endDate), "MMM dd, yyyy")}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="line-clamp-1 max-w-[150px]">{event.location.address}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={getStatusBadgeVariant(event.status)}>{event.status.toUpperCase()}</Badge>
                            {event.status === 'cancelled' && <JobStatusBadge eventId={event.id} />}
                            {event.cancellationStatus === 'CANCELLATION_PENDING' && (
                              <Badge variant="outline" className="text-[10px] animate-pulse">PROCESSING...</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditEvent(event)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRescheduleClick(event)}
                              disabled={event.status === 'cancelled' || event.status === 'completed'}
                              title="Reschedule"
                            >
                              <CalendarDays className="h-4 w-4" />
                            </Button>
                            {event.status === 'upcoming' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-orange-500 hover:text-orange-600"
                                onClick={() => handleCancelEventClick(event)}
                                title="Cancel Event"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, data.total)} of {data.total} events
                </div>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * 15 >= data.total}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EventDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} event={selectedEvent} onSave={handleSaveEvent} />
      <EventCancellationDialog
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleConfirmCancel}
        isLoading={cancelMutation.isPending}
      />
      <RescheduleDialog
        isOpen={rescheduleDialogOpen}
        onClose={() => setRescheduleDialogOpen(false)}
        onConfirm={handleConfirmReschedule}
        event={selectedEvent}
        isLoading={rescheduleMutation.isPending}
      />
    </div>
  );
}
