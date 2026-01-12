import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, CheckCircle2, Clock, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/Tag";
import { Event } from "@/types";
import { format } from "date-fns";

interface EventCardProps {
  event: Event;
  onRegister?: (event: Event) => void;
  showCapacityWarning?: boolean;
  className?: string;
}

export const EventCard = ({
  event,
  onRegister,
  showCapacityWarning = true,
  className = "",
}: EventCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isCompleted = event.status === "completed";
  const displayAddress = event.location?.address || event.contactAddress;

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

  const formatTime = (time?: string) => {
    if (!time) return "";
    return time;
  };

  const handleRegisterClick = () => {
    // Navigate to registration page
    navigate(`/event/register/${event.id}`);
  };

  const handleCardClick = () => {
    // Navigate to event detail page
    navigate(`/event/${event.id}`);
  };

  return (
    <Card
      className={`overflow-hidden hover:shadow-elevated transition-all duration-300 flex flex-col h-full cursor-pointer ${className}`}
      onClick={handleCardClick}
    >
      {event.image && (
        <div className="relative h-48">
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
          <Tag
            variant={getStatusVariant(event.status)}
            className="absolute top-4 right-4"
          >
            {t(`events.${event.status}`)}
          </Tag>
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-xl">{event.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {event.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-grow">
        <div className="space-y-3 text-sm">
          {/* Date and Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">
                {event.startDate
                  ? format(new Date(event.startDate), "PPP")
                  : "TBA"}
                {event.endDate && event.endDate !== event.startDate && (
                  <> - {format(new Date(event.endDate), "PPP")}</>
                )}
              </span>
              {(event.startTime || event.endTime) && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTime(event.startTime)}
                  {event.endTime && <> - {formatTime(event.endTime)}</>}
                </span>
              )}
            </div>
          </div>

          {/* Address */}
          {displayAddress && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <span className="text-foreground leading-relaxed">
                {displayAddress}
              </span>
            </div>
          )}

          {/* Registration Amount */}
          <div className="flex items-center gap-3">
            <Banknote className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="font-medium text-foreground">
              {event.registrationAmount === 0 ||
                event.registrationAmount === undefined
                ? "Free Entry"
                : `₹${event.registrationAmount}`}
            </span>
          </div>
        </div>

        {isCompleted && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{t("events.successfullyCompleted")}</span>
          </div>
        )}
      </CardContent>

      {!isCompleted && event.isRegistrationEnabled !== false && (
        <CardFooter className="mt-auto">
          <Button
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              handleRegisterClick();
            }}
          >
            {t("events.register")}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
