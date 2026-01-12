import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileService, ProfileData } from "@/services/profile.service";
import { donationService } from "@/services/donation.service";
import { eventRegistrationService, EventRegistration } from "@/services/event-registration.service";
import { addressService } from "@/services/address.service";
import { CreateAddressDto } from "@/types";
import { getErrorMessage } from "@/lib/errorUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileHeader from "@/components/profile/ProfileHeader";
import PersonalInfoForm from "@/components/profile/PersonalInfoForm";
import AddressManager from "@/components/profile/AddressManager";
import DeleteAccountSection from "@/components/profile/DeleteAccountSection";
import DonationManager from "@/components/profile/DonationManager";
import { UpdatePasswordDialog } from "@/components/profile/UpdatePasswordDialog";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import { Loader2, Heart, Calendar, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState("account");
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: profileService.getProfile,
    enabled: !!user, // Only fetch if user is logged in
  });

  // Fetch event registrations
  const { data: eventRegistrations = [], isLoading: registrationsLoading } = useQuery({
    queryKey: ["myEventRegistrations"],
    queryFn: eventRegistrationService.getMyRegistrations,
    enabled: !!user,
  });

  // Fetch subscriptions for visibility check
  const { data: subscriptionsData } = useQuery({
    queryKey: ["mySubscriptions"],
    queryFn: donationService.getSubscriptions,
    enabled: !!user,
  });
  const hasSubscriptions = subscriptionsData?.subscriptions?.length > 0;

  // Cancel registration mutation
  const cancelRegistrationMutation = useMutation({
    mutationFn: eventRegistrationService.cancelRegistration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myEventRegistrations"] });
      toast({
        title: "Registration Cancelled",
        description: "Your event registration has been cancelled.",
      });
      setSelectedRegId(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Cancellation Failed",
        description: getErrorMessage(error, "Could not cancel registration."),
        variant: "destructive",
      });
    },
  });

  const confirmCancelRegistration = () => {
    if (selectedRegId) {
      cancelRegistrationMutation.mutate(selectedRegId);
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: profileService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update profile"),
        variant: "destructive",
      });
    },
  });

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: profileService.uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to upload avatar"),
        variant: "destructive",
      });
    },
  });

  // Delete avatar mutation
  const deleteAvatarMutation = useMutation({
    mutationFn: profileService.deleteAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Success",
        description: "Profile picture removed successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete avatar"),
        variant: "destructive",
      });
    },
  });

  // Address mutations
  const addAddressMutation = useMutation({
    mutationFn: addressService.createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Success",
        description: "Address added successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to add address"),
        variant: "destructive",
      });
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateAddressDto }) =>
      addressService.updateAddress(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Success",
        description: "Address updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update address"),
        variant: "destructive",
      });
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: addressService.deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Success",
        description: "Address deleted successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete address"),
        variant: "destructive",
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: addressService.setPrimary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Success",
        description: "Primary address updated",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to set primary address"),
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: profileService.deleteAccount,
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account has been successfully deleted",
      });
      logout();
      navigate("/");
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete account"),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Profile not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <ProfileHeader
          name={profile.name}
          email={profile.email}
          phone={profile.phone}
          avatarUrl={profile.avatarUrl}
          onAvatarUpdate={(file) => uploadAvatarMutation.mutate(file)}
          onAvatarDelete={() => deleteAvatarMutation.mutate()}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 lg:w-auto h-auto">
            <TabsTrigger value="account">Account Settings</TabsTrigger>
            <TabsTrigger value="events">Event Registrations</TabsTrigger>
            {hasSubscriptions && (
              <TabsTrigger value="donations">Donations</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="account" className="space-y-6 mt-6">
            <PersonalInfoForm
              initialData={{
                firstName: profile.firstName,
                lastName: profile.lastName,
                gender: profile.gender,
                email: profile.email,
                phone: profile.phone,
              }}
              onSave={(data) => updateProfileMutation.mutateAsync(data)}
              loading={updateProfileMutation.isPending}
              onChangePassword={() => setPasswordDialogOpen(true)}
            />

            <UpdatePasswordDialog
              open={passwordDialogOpen}
              onOpenChange={setPasswordDialogOpen}
            />

            <AddressManager
              addresses={profile.addresses}
              onAdd={(data) => addAddressMutation.mutateAsync(data)}
              onUpdate={(id, data) =>
                updateAddressMutation.mutateAsync({ id, data })
              }
              onDelete={(id) => deleteAddressMutation.mutateAsync(id)}
              onSetPrimary={(id) => setPrimaryMutation.mutateAsync(id)}
            />

            <DeleteAccountSection
              onDelete={() => deleteAccountMutation.mutateAsync()}
            />
          </TabsContent>



          <TabsContent value="events" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <CardTitle>My Event Registrations</CardTitle>
                </div>
                <CardDescription>
                  View your registered events and payment history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {registrationsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : eventRegistrations.length > 0 ? (
                  <div className="space-y-4">
                    {eventRegistrations.map((reg: EventRegistration) => (
                      <div
                        key={reg.id}
                        className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/event/${reg.event_id}`)}
                      >
                        {/* Event Image */}
                        <div className="w-full md:w-32 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                          {reg.events?.image ? (
                            <img
                              src={reg.events.image}
                              alt={reg.events.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Calendar className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-lg truncate">
                                {reg.events?.title || 'Event'}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {reg.events?.start_date
                                  ? format(new Date(reg.events.start_date), 'PPP')
                                  : 'Date TBD'}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge
                                variant={
                                  reg.status === 'cancelled' ? 'destructive' :
                                    reg.payment_status === 'paid' ? 'default' :
                                      reg.payment_status === 'free' ? 'secondary' : 'outline'
                                }
                              >
                                {reg.status === 'cancelled' ? 'CANCELLED' :
                                  reg.payment_status === 'paid'
                                    ? `₹${reg.amount} Paid`
                                    : reg.payment_status === 'free'
                                      ? 'Free Entry'
                                      : 'Pending'}
                              </Badge>
                              <Badge variant="outline" className="font-mono text-xs">
                                {reg.registration_number}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Registered: {format(new Date(reg.created_at), 'PP')}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-primary hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/event/${reg.event_id}`);
                              }}
                            >
                              View Event <ExternalLink className="ml-1 h-3 w-3" />
                            </Button>

                            {/* Only show cancel for free/unpaid events that aren't already cancelled */}
                            {reg.status !== 'cancelled' && reg.status !== 'completed' && reg.payment_status !== 'paid' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-destructive hover:text-destructive ml-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRegId(reg.id);
                                }}
                              >
                                Cancel Registration
                              </Button>
                            )}
                          </div>

                          {reg.status === 'cancelled' && (
                            <div className="mt-1 text-xs text-destructive font-medium">
                              Cancelled
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="mx-auto h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">
                      No Event Registrations Yet
                    </p>
                    <p className="text-sm mb-4">
                      You haven't registered for any events yet
                    </p>
                    <Button onClick={() => navigate('/events')}>Browse Events</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <AlertDialog open={!!selectedRegId} onOpenChange={(open) => !open && setSelectedRegId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Event Registration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel your registration for this event?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Registration</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmCancelRegistration}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelRegistrationMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>


          {hasSubscriptions && (
            <TabsContent value="donations" className="mt-6">
              <DonationManager />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
