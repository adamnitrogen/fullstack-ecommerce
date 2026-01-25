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
import { cn } from "@/lib/utils";

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
      case "cancelled":
        return "destructive" as const;
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
      className={`group overflow-hidden hover:shadow-elevated transition-all duration-500 flex flex-col h-full cursor-pointer border-none bg-white rounded-[2.5rem] ${className}`}
      onClick={handleCardClick}
    >
      {event.image && (
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="absolute top-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg backdrop-blur-md",
              event.status === "ongoing" ? "bg-green-500 text-white" :
                event.status === "cancelled" ? "bg-destructive text-destructive-foreground" :
                  "bg-[#B85C3C] text-white"
            )}>
              {t(`events.${event.status}`)}
            </span>
          </div>
        </div>
      )}

      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-1 w-8 bg-[#B85C3C] rounded-full" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B85C3C]">
            {event.registrationAmount === 0 ? "Complimentary" : "Sacred Offering"}
          </span>
        </div>
        <CardTitle className="text-2xl font-playfair font-bold text-[#2C1810] group-hover:text-[#B85C3C] transition-colors duration-300">
          {event.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-8 space-y-6 flex-grow">
        <div className="space-y-4">
          {/* Date and Time */}
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-2xl bg-[#B85C3C]/5 flex items-center justify-center text-[#B85C3C] flex-shrink-0 group-hover:bg-[#B85C3C] group-hover:text-white transition-colors duration-500">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#2C1810]">
                {event.startDate ? format(new Date(event.startDate), "PPP") : "TBA"}
              </span>
              {event.startTime && (
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  {event.startTime} {event.endTime && ` — ${event.endTime}`}
                </span>
              )}
            </div>
          </div>

          {/* Address */}
          {displayAddress && (
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-[#B85C3C]/5 flex items-center justify-center text-[#B85C3C] flex-shrink-0 group-hover:bg-[#B85C3C] group-hover:text-white transition-colors duration-500">
                <MapPin className="h-5 w-5" />
              </div>
              <span className="text-sm text-muted-foreground font-light line-clamp-1 italic">
                {displayAddress}
              </span>
            </div>
          )}
        </div>

        {isCompleted && (
          <div className="flex items-center gap-3 bg-green-50 px-4 py-2 rounded-xl text-xs font-bold text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t("events.successfullyCompleted")}</span>
          </div>
        )}
      </CardContent>

      {/* Show Cancelled button for cancelled events */}
      {event.status === 'cancelled' && (
        <CardFooter className="p-8 pt-0">
          <Button
            disabled
            className="w-full h-12 rounded-full bg-red-100 text-red-700 font-bold uppercase tracking-widest text-xs shadow-none cursor-not-allowed border-none"
          >
            {t("events.cancelled")}
          </Button>
        </CardFooter>
      )}

      {/* Show Register button for upcoming and ongoing events */}
      {(event.status === 'upcoming' || event.status === 'ongoing') && event.isRegistrationEnabled !== false && (
        <CardFooter className="p-8 pt-0">
          <Button
            className="w-full h-12 rounded-full bg-[#2C1810] hover:bg-[#B85C3C] text-white font-bold uppercase tracking-widest text-xs shadow-lg hover:shadow-xl transition-all duration-300 border-none"
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
