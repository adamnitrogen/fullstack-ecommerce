import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, CheckCircle2, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EventCard } from "@/components/EventCard";
import { Event } from "@/types";
import { useAuthStore } from "@/store/authStore";

import { useInfiniteQuery } from "@tanstack/react-query";
import { eventService } from "@/services/event.service";
import { PhoneInput } from "@/components/ui/phone-input";

export default function Events() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [registrationData, setRegistrationData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["events", activeTab],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await eventService.getAll({
        page: pageParam,
        limit: 10,
        status: activeTab,
      });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap((p) => p.events).length;
      if (loadedCount < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const events = data?.pages.flatMap((page) => page.events) || [];
  const totalEvents = data?.pages[0]?.total || 0;

  const handleRegister = (event: Event) => {
    setSelectedEvent(event);
    setRegistrationOpen(true);
  };

  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.email || user.email.trim() === "") {
      toast({
        title: "Email Required",
        description:
          "Please add your email address in profile settings before registering for an event.",
        variant: "destructive",
      });
      return;
    }

    if (
      !registrationData.name ||
      !registrationData.email ||
      !registrationData.phone
    ) {
      toast({
        title: t("events.error"),
        description: t("events.fillRequired"),
        variant: "destructive",
      });
      return;
    }

    // TODO: Submit registration to backend
    toast({
      title: t("events.registrationSuccess"),
      description: t("events.confirmationSent"),
    });

    setRegistrationOpen(false);
    setRegistrationData({ name: "", email: "", phone: "", message: "" });
  };

  const renderEventList = (emptyIcon: React.ReactNode, emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading events...</p>
        </div>
      );
    }

    if (events.length === 0) {
      return (
        <div className="text-center py-12">
          {emptyIcon}
          <p className="text-muted-foreground text-lg mt-4">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div key={event.id} className="w-full max-w-[420px] mx-auto">
              <EventCard event={event} onRegister={handleRegister} />
            </div>
          ))}
        </div>

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="min-w-[200px]"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading more...
                </>
              ) : (
                "Load More Events"
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("events.pageTitle")}</h1>
          <p className="text-muted-foreground">{t("events.pageSubtitle")}</p>
        </div>

        {/* Events Tabs */}
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="all">
              All {activeTab === "all" && events.length > 0 && `(${totalEvents})`}
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              {t("events.upcoming")} {activeTab === "upcoming" && events.length > 0 && `(${totalEvents})`}
            </TabsTrigger>
            <TabsTrigger value="ongoing">
              {t("events.ongoing")} {activeTab === "ongoing" && events.length > 0 && `(${totalEvents})`}
            </TabsTrigger>
            <TabsTrigger value="completed">
              {t("events.completed")} {activeTab === "completed" && events.length > 0 && `(${totalEvents})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            {renderEventList(
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto opacity-50" />,
              "No events available at the moment"
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-0">
            {renderEventList(
              <Clock className="h-16 w-16 text-muted-foreground mx-auto opacity-50" />,
              t("events.noUpcoming")
            )}
          </TabsContent>

          <TabsContent value="ongoing" className="mt-0">
            {renderEventList(
              <Clock className="h-16 w-16 text-muted-foreground mx-auto opacity-50" />,
              t("events.noOngoing")
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-0">
            {renderEventList(
              <CheckCircle2 className="h-16 w-16 text-muted-foreground mx-auto opacity-50" />,
              t("events.noCompleted")
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Registration Dialog */}
      <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("events.registerFor")}</DialogTitle>
            <DialogDescription>
              {selectedEvent?.title || "Complete your registration details below"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRegistration} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">
                {t("events.fullName")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reg-name"
                type="text"
                value={registrationData.name}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    name: e.target.value,
                  })
                }
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email">
                {t("events.email")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reg-email"
                type="email"
                value={registrationData.email}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    email: e.target.value,
                  })
                }
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <PhoneInput
                id="reg-phone"
                value={registrationData.phone}
                onChange={(val) =>
                  setRegistrationData({
                    ...registrationData,
                    phone: val,
                  })
                }
                label={t("events.phone")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-message">{t("events.message")}</Label>
              <Textarea
                id="reg-message"
                value={registrationData.message}
                onChange={(e) =>
                  setRegistrationData({
                    ...registrationData,
                    message: e.target.value,
                  })
                }
                placeholder={t("events.messagePlaceholder")}
                rows={3}
              />
            </div>

            {selectedEvent && (
              <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(selectedEvent.startDate), "PPP")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedEvent.location.address}</span>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full">
              {t("events.confirmRegistration")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
