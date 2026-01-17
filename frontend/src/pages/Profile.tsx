import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileService, ProfileData, UpdateProfileData } from "@/services/profile.service";
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
import { EventCancellationDialog } from "@/components/admin/EventCancellationDialog";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Loader2, Heart, Calendar, ExternalLink, User, Sparkles, UserCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

import { useTranslation } from "react-i18next";

export default function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState("account");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const [page, setPage] = useState(1);
  const LIMIT = 5;

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: profileService.getProfile,
    enabled: !!user,
  });

  // Fetch event registrations
  const { data: registrationsData, isLoading: registrationsLoading } = useQuery({
    queryKey: ["myEventRegistrations", page],
    queryFn: () => eventRegistrationService.getMyRegistrations({ page, limit: LIMIT }),
    enabled: !!user,
  });

  const eventRegistrations = registrationsData?.registrations || [];
  const totalRegistrations = registrationsData?.total || 0;

  // Fetch subscriptions for visibility check
  const { data: subscriptionsData } = useQuery<{ subscriptions: any[] }>({
    queryKey: ["mySubscriptions"],
    queryFn: donationService.getSubscriptions,
    enabled: !!user,
  });
  const hasSubscriptions = (subscriptionsData?.subscriptions?.length ?? 0) > 0;

  // Cancel registration mutation
  const cancelRegistrationMutation = useMutation({
    mutationFn: (vars: { registrationId: string; reason: string }) => eventRegistrationService.cancelRegistration(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myEventRegistrations"] });
      toast({
        title: "Registration Cancelled",
        description: "Your event registration has been cancelled successfully.",
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

  const confirmCancelRegistration = async (reason: string): Promise<void> => {
    if (selectedRegId) {
      await cancelRegistrationMutation.mutateAsync({ registrationId: selectedRegId, reason });
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => profileService.updateProfile(data),
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
    mutationFn: (file: File) => profileService.uploadAvatar(file),
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
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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
    mutationFn: ({ id, type }: { id: string; type: 'home' | 'work' | 'other' }) =>
      addressService.setPrimary(id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
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



  if (isLoading) {
    return <LoadingOverlay isLoading={true} message="Loading your profile..." />;
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Profile not found</p>
      </div>
    );
  }

  // Helper functions for mutations to match the new structure's expectations
  const handleAvatarUpdate = (file: File) => uploadAvatarMutation.mutate(file);
  const handleAvatarDelete = () => deleteAvatarMutation.mutate();
  const handleUpdateProfile = async (data: UpdateProfileData) => {
    await updateProfileMutation.mutateAsync(data);
  };
  const setShowPasswordDialog = (open: boolean) => setPasswordDialogOpen(open);

  const isAddressActionLoading =
    addAddressMutation.isPending ||
    updateAddressMutation.isPending ||
    deleteAddressMutation.isPending ||
    setPrimaryMutation.isPending;

  const addressActionMessage =
    addAddressMutation.isPending ? "Creating new sanctuary..." :
      updateAddressMutation.isPending ? "Updating your sanctuary..." :
        deleteAddressMutation.isPending ? "Removing sanctuary..." :
          setPrimaryMutation.isPending ? "Setting primary sanctuary..." :
            "Loading your profile...";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay
        isLoading={isLoading || isAddressActionLoading}
        message={addressActionMessage}
      />

      {/* Premium Compact Hero Section */}
      <section className="bg-[#2C1810] text-white py-12 md:py-16 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <UserCircle className="h-48 w-48 text-[#B85C3C]" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                <Sparkles className="h-3 w-3" /> {t("profile.dashboard", "User Dashboard")}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-playfair">
                My <span className="text-[#B85C3C]">{t("profile.profile", "Profile")}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-white/50 text-sm font-light border-l border-[#B85C3C]/30 pl-6 hidden md:flex">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-white">Profile</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20 pb-20">
        <div className="space-y-8">
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ProfileHeader
              name={`${profile.firstName} ${profile.lastName || ""}`}
              email={profile.email}
              phone={profile.phone}
              avatarUrl={profile.avatarUrl}
              isEmailVerified={profile.emailVerified}
              onAvatarUpdate={handleAvatarUpdate}
              onAvatarDelete={handleAvatarDelete}
            />
          </section>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-start mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="h-14 rounded-full bg-white shadow-elevated p-1.5 border border-border/50">
                <TabsTrigger value="account" className="rounded-full px-8 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-[0.15em]">
                  Account Settings
                </TabsTrigger>
                <TabsTrigger value="events" className="rounded-full px-8 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-[0.15em]">
                  Events
                </TabsTrigger>
                {hasSubscriptions && (
                  <TabsTrigger value="donations" className="rounded-full px-8 data-[state=active]:bg-[#2C1810] data-[state=active]:text-white transition-all font-bold text-xs uppercase tracking-[0.15em]">
                    Donations
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="account" className="animate-in fade-in-0 zoom-in-95 duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                  <PersonalInfoForm
                    initialData={{
                      firstName: profile.firstName || "",
                      lastName: profile.lastName || "",
                      gender: profile.gender,
                      email: profile.email,
                      phone: profile.phone,
                    }}
                    onSave={handleUpdateProfile}
                    onChangePassword={() => setPasswordDialogOpen(true)}
                    loading={updateProfileMutation.isPending}
                  />

                  <AddressManager
                    addresses={profile.addresses}
                    onAdd={async (data) => {
                      await addAddressMutation.mutateAsync(data);
                    }}
                    onUpdate={async (id, data) => {
                      await updateAddressMutation.mutateAsync({ id, data });
                    }}
                    onDelete={async (id) => {
                      await deleteAddressMutation.mutateAsync(id);
                    }}
                    onSetPrimary={async (id) => {
                      const addr = profile.addresses.find(a => a.id === id);
                      if (addr) {
                        const type = (addr.type === 'home' || addr.type === 'work' || addr.type === 'other')
                          ? addr.type as 'home' | 'work' | 'other'
                          : 'other';
                        await setPrimaryMutation.mutateAsync({ id, type });
                      } else {
                        // Address not found handled gracefully
                      }
                    }}
                  />
                </div>

                <div className="space-y-8">
                  {user?.role !== 'admin' && (
                    <DeleteAccountSection
                      onDelete={async () => navigate('/account/delete')}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="events" className="animate-in fade-in-0 zoom-in-95 duration-300">
              <Card className="shadow-elevated border-none rounded-[2rem] overflow-hidden">
                <CardHeader className="bg-muted/30 pb-6">
                  <div className="flex items-center gap-3 text-[#2C1810]">
                    <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                      <Calendar className="h-5 w-5 text-[#B85C3C]" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-playfair">Event Registrations</CardTitle>
                      <CardDescription>View your upcoming and past sacred gatherings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {registrationsLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#B85C3C]" />
                    </div>
                  ) : eventRegistrations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {eventRegistrations.map((reg: EventRegistration) => (
                        <div
                          key={reg.id}
                          className="group flex flex-col sm:flex-row gap-4 p-5 border border-border/50 rounded-3xl hover:bg-[#FDFBF9] hover:border-[#B85C3C]/30 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
                          onClick={() => navigate(`/event/${reg.event_id}`)}
                        >
                          {/* Event Image */}
                          <div className="w-full sm:w-28 h-28 bg-muted rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">
                            {reg.events?.image ? (
                              <img
                                src={reg.events.image}
                                alt={reg.events.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                <Calendar className="h-10 w-10 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>

                          {/* Event Details */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-bold text-[#2C1810] line-clamp-1 group-hover:text-[#B85C3C] transition-colors">
                                  {reg.events?.title || 'Sacred Gathering'}
                                </h3>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Calendar className="h-3 w-3" />
                                  {reg.events?.start_date
                                    ? format(new Date(reg.events.start_date), 'PPP')
                                    : 'Date TBD'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {reg.status === 'cancelled' ? (
                                <Badge variant="destructive" className="text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                                  CANCELLED
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border-none shadow-sm ${reg.payment_status === 'paid' ? 'bg-green-50 text-green-700' :
                                    reg.payment_status === 'free' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                                    }`}
                                >
                                  {reg.payment_status === 'paid'
                                    ? `₹${reg.amount} PAID`
                                    : reg.payment_status === 'free'
                                      ? 'COMPLIMENTARY'
                                      : 'PENDING'}
                                </Badge>
                              )}

                              {reg.status === 'cancelled' && reg.refunds && reg.refunds.length > 0 && (
                                <Badge variant="outline" className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm ${reg.refunds[0].status === 'SETTLED' ? 'bg-green-100 text-green-800' :
                                  reg.refunds[0].status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                  Refund: {reg.refunds[0].status}
                                </Badge>
                              )}

                              <Badge variant="secondary" className="text-[10px] font-mono bg-muted/50 text-muted-foreground">
                                #{reg.registration_number}
                              </Badge>
                            </div>

                            {reg.cancellationReason && (
                              <p className="text-[10px] text-muted-foreground italic mt-2 line-clamp-2">
                                Reason: {reg.cancellationReason}
                              </p>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-0 text-[11px] font-bold uppercase tracking-wider text-[#B85C3C] hover:bg-transparent hover:text-[#2C1810]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/event/${reg.event_id}`);
                                }}
                              >
                                Details
                              </Button>

                              {reg.status !== 'cancelled' && reg.status !== 'completed' && reg.payment_status !== 'paid' && (
                                <button
                                  className="text-[11px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRegId(reg.id);
                                  }}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-[#FDFBF9] rounded-[2rem] border-2 border-dashed border-border/50">
                      <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Calendar className="h-8 w-8 text-muted-foreground opacity-30" />
                      </div>
                      <h3 className="text-[#2C1810] font-bold text-lg">No Registrations Found</h3>
                      <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1 mb-6">
                        You haven't joined any sacred events yet. Discover upcoming spiritual gatherings.
                      </p>
                      <Button
                        onClick={() => navigate('/events')}
                        className="rounded-full px-8 bg-[#2C1810] hover:bg-[#B85C3C] transition-all"
                      >
                        Explore Events
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pagination Controls */}
              {totalRegistrations > LIMIT && (
                <div className="flex items-center justify-between mt-6 px-2">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * LIMIT + 1} to {Math.min(page * LIMIT, totalRegistrations)} of {totalRegistrations} registrations
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-full"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * LIMIT >= totalRegistrations}
                      className="rounded-full"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {hasSubscriptions && (
              <TabsContent value="donations" className="animate-in fade-in-0 zoom-in-95 duration-300">
                <DonationManager />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <UpdatePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />

      <EventCancellationDialog
        isOpen={!!selectedRegId}
        onClose={() => setSelectedRegId(null)}
        onConfirm={confirmCancelRegistration}
        title="Cancel Registration?"
        description="Are you sure you want to cancel your attendance? A reason is required to free up space for another seeker."
        warningText="This action is irreversible. For free events, this happens immediately. For paid events, please contact support as automated online cancellation is disabled for security."
        confirmLabel="Confirm Cancellation"
        isLoading={cancelRegistrationMutation.isPending}
      />
    </div>
  );
}
