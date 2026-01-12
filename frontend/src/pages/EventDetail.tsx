import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  Clock,
  Banknote,
  ArrowLeft,
  User,
  Sparkles,
  Gift,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/Tag";
import { Separator } from "@/components/ui/separator";
import { eventService } from "@/services/event.service";
import { Event } from "@/types";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventService.getById(eventId || ""),
    enabled: !!eventId,
  });

  const handleRegister = () => {
    if (eventId) {
      navigate(`/event/register/${eventId}`);
    }
  };

  if (isLoading) {
    return <LoadingOverlay isLoading={true} message="Loading event details..." />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Event not found</h2>
          <Button onClick={() => navigate("/events")}>Back to Events</Button>
        </div>
      </div>
    );
  }

  const eventData = event;
  const registrationAmount = eventData.registrationAmount || 0;
  const isFree = registrationAmount === 0;
  const isKatha = eventData.category === "katha";
  const showRegistration = eventData.isRegistrationEnabled !== false;

  const getStatusVariant = (status: Event["status"]) => {
    switch (status) {
      case "upcoming":
        return "info" as const;
      case "ongoing":
        return "success" as const;
      case "completed":
        return "default" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Back Button */}
        <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Event Image */}
          <div className="relative">
            {eventData.image ? (
              <div className="relative h-full">
                <img
                  src={eventData.image}
                  alt={eventData.title}
                  loading="lazy"
                  className="w-full h-full rounded-lg shadow-lg object-cover"
                />
                <Tag
                  variant={getStatusVariant(eventData.status)}
                  className="absolute top-4 right-4"
                >
                  {t(`events.${eventData.status}`)}
                </Tag>
              </div>
            ) : (
              <Card className="h-full min-h-[400px] flex items-center justify-center bg-muted">
                <CardContent className="text-center py-12">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No event image available
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Side - Event Details */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-4xl font-bold mb-2">{eventData.title}</h1>
              {eventData.category && (
                <Tag variant="category" size="sm">
                  {eventData.category.charAt(0).toUpperCase() +
                    eventData.category.slice(1)}
                </Tag>
              )}
            </div>

            {/* Katha Vachak - Only for Katha events */}
            {isKatha && eventData.kathaVachak && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Katha Vachak
                      </p>
                      <p className="font-semibold">{eventData.kathaVachak}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Event Info */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Date and Time */}
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(new Date(eventData.startDate), "PPP")}
                      {eventData.endDate &&
                        eventData.endDate !== eventData.startDate && (
                          <> - {format(new Date(eventData.endDate), "PPP")}</>
                        )}
                    </p>
                    {(eventData.startTime || eventData.endTime) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {eventData.startTime}
                        {eventData.endTime && <> - {eventData.endTime}</>}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Registration Amount */}
                {showRegistration && (
                  <>
                    <div className="flex items-center gap-3">
                      <Banknote className="h-5 w-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Registration Fee
                        </p>
                        <p className="font-semibold text-lg">
                          {isFree ? "Free Entry" : `₹${registrationAmount}`}
                        </p>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Location */}
                {eventData.location?.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">
                        {eventData.location.address}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Registration Button - Only if enabled */}
            {showRegistration && eventData.status !== "completed" && (
              <Button onClick={handleRegister} className="w-full" size="lg">
                Register for Event
              </Button>
            )}
          </div>
        </div>

        {/* Event Description */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>About This Event</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {eventData.description}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Key Highlights */}
        {eventData.keyHighlights && eventData.keyHighlights.length > 0 && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>Key Highlights</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {eventData.keyHighlights.map((highlight, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-muted-foreground"
                    >
                      <span className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Special Privileges */}
        {eventData.specialPrivileges &&
          eventData.specialPrivileges.length > 0 && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    <CardTitle>Special Privileges for Devotees</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {eventData.specialPrivileges.map((privilege, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-muted-foreground"
                      >
                        <span className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>{privilege}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </div>
  );
};

export default EventDetail;
