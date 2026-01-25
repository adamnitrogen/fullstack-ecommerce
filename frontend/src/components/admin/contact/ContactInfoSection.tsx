import { logger } from "@/lib/logger";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, Phone, Mail, MapPin, Loader2 } from "lucide-react";
import { ContactPhone, ContactEmail, ContactAddress, contactInfoService } from "@/services/contact-info.service";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, getFriendlyTitle } from "@/lib/errorUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ContactInfoSectionProps {
  phones: ContactPhone[];
  emails: ContactEmail[];
  address: ContactAddress;
}

export function ContactInfoSection({
  phones,
  emails,
  address,
}: ContactInfoSectionProps) {
  const queryClient = useQueryClient();
  const [newPhone, setNewPhone] = useState({ number: "", label: "" });
  const [newEmail, setNewEmail] = useState({ email: "", label: "" });
  const [editAddress, setEditAddress] = useState<ContactAddress>(address);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // --- PHONES ---
  const addPhoneMutation = useMutation({
    mutationFn: contactInfoService.addPhone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
      setNewPhone({ number: "", label: "" });
      toast({ title: "Success", description: "Phone number added" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to add phone"),
        variant: "destructive",
      });
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContactPhone> }) =>
      contactInfoService.updatePhone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to update phone"),
        variant: "destructive",
      });
    },
  });

  const deletePhoneMutation = useMutation({
    mutationFn: contactInfoService.deletePhone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
      toast({ title: "Success", description: "Phone number removed" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to remove phone"),
        variant: "destructive",
      });
    },
  });

  const handleAddPhone = () => {
    if (!newPhone.number) {
      toast({ title: "Check your info", description: "Please enter a phone number", variant: "destructive" });
      return;
    }
    addPhoneMutation.mutate({
      number: newPhone.number,
      label: newPhone.label,
      is_primary: phones.length === 0,
      is_active: true,
      display_order: phones.length + 1,
    });
  };

  // --- EMAILS ---
  const addEmailMutation = useMutation({
    mutationFn: contactInfoService.addEmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
      setNewEmail({ email: "", label: "" });
      toast({ title: "Success", description: "Email address added" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to add email"),
        variant: "destructive",
      });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContactEmail> }) =>
      contactInfoService.updateEmail(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to update email"),
        variant: "destructive",
      });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: contactInfoService.deleteEmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
      toast({ title: "Success", description: "Email address removed" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to remove email"),
        variant: "destructive",
      });
    },
  });

  const handleAddEmail = () => {
    if (!newEmail.email) {
      toast({ title: "Check your info", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    addEmailMutation.mutate({
      email: newEmail.email,
      label: newEmail.label,
      is_primary: emails.length === 0,
      is_active: true,
      display_order: emails.length + 1,
    });
  };

  // --- ADDRESS ---
  const updateAddressMutation = useMutation({
    mutationFn: contactInfoService.updateAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-info"] });
      queryClient.invalidateQueries({ queryKey: ["contact-info-public"] });
      setIsEditingAddress(false);
      toast({ title: "Success", description: "Address updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, "Notice"),
        description: getErrorMessage(error, "Failed to update address"),
        variant: "destructive",
      });
    },
  });

  const handleUpdateAddress = () => {
    updateAddressMutation.mutate(editAddress);
  };

  // Helper to format address for display
  const formatAddress = (addr: ContactAddress) => {
    if (!addr) return "No address set";
    const parts = [
      addr.address_line1,
      addr.address_line2,
      addr.city,
      addr.state,
      addr.pincode,
      addr.country
    ].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <div className="space-y-6">
      {/* Phone Numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-semibold">Add New Phone Number</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <PhoneInput
                  value={newPhone.number}
                  onChange={(value) =>
                    setNewPhone({ ...newPhone, number: value as string })
                  }
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Label (Optional)</Label>
                <Input
                  value={newPhone.label}
                  onChange={(e) =>
                    setNewPhone({ ...newPhone, label: e.target.value })
                  }
                  placeholder="e.g., Main Office"
                />
              </div>
            </div>
            <Button onClick={handleAddPhone} size="sm" disabled={addPhoneMutation.isPending}>
              {addPhoneMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Phone
            </Button>
          </div>

          <div className="space-y-3">
            {phones.map((phone) => (
              <div
                key={phone.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={phone.is_primary}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updatePhoneMutation.mutate({ id: phone.id, data: { is_primary: true } });
                      } else {
                        updatePhoneMutation.mutate({ id: phone.id, data: { is_primary: false } });
                      }
                    }}
                  />
                  <div>
                    <p className="font-medium">{phone.number}</p>
                    {phone.label && (
                      <p className="text-sm text-muted-foreground">
                        {phone.label}
                      </p>
                    )}
                    {phone.is_primary && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!confirm("Delete this phone number?")) return;

                    // If deleting primary and there are others, make another one primary first
                    if (phone.is_primary && phones.length > 1) {
                      const nextPrimary = phones.find(p => p.id !== phone.id);
                      if (nextPrimary) {
                        try {
                          await updatePhoneMutation.mutateAsync({
                            id: nextPrimary.id,
                            data: { is_primary: true }
                          });
                          toast({ title: "Info", description: "Primary status transferred to next number" });
                        } catch (error) {
                          logger.error("Failed to transfer primary status", error);
                          // Continue with deletion anyway? Or stop?
                          // Let's continue but warn
                        }
                      }
                    }
                    deletePhoneMutation.mutate(phone.id);
                  }}
                  disabled={deletePhoneMutation.isPending}
                >
                  {deletePhoneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Addresses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-semibold">Add New Email Address</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={newEmail.email}
                  onChange={(e) =>
                    setNewEmail({ ...newEmail, email: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Label (Optional)</Label>
                <Input
                  value={newEmail.label}
                  onChange={(e) =>
                    setNewEmail({ ...newEmail, label: e.target.value })
                  }
                  placeholder="e.g., General Inquiries"
                />
              </div>
            </div>
            <Button onClick={handleAddEmail} size="sm" disabled={addEmailMutation.isPending}>
              {addEmailMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Email
            </Button>
          </div>

          <div className="space-y-3">
            {emails.map((email) => (
              <div
                key={email.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={email.is_primary}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateEmailMutation.mutate({ id: email.id, data: { is_primary: true } });
                      } else {
                        updateEmailMutation.mutate({ id: email.id, data: { is_primary: false } });
                      }
                    }}
                  />
                  <div>
                    <p className="font-medium">{email.email}</p>
                    {email.label && (
                      <p className="text-sm text-muted-foreground">
                        {email.label}
                      </p>
                    )}
                    {email.is_primary && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!confirm("Delete this email?")) return;

                    // If deleting primary and there are others, make another one primary first
                    if (email.is_primary && emails.length > 1) {
                      const nextPrimary = emails.find(e => e.id !== email.id);
                      if (nextPrimary) {
                        try {
                          await updateEmailMutation.mutateAsync({
                            id: nextPrimary.id,
                            data: { is_primary: true }
                          });
                          toast({ title: "Info", description: "Primary status transferred to next email" });
                        } catch (error) {
                          logger.error("Failed to transfer primary status", error);
                        }
                      }
                    }
                    deleteEmailMutation.mutate(email.id);
                  }}
                  disabled={deleteEmailMutation.isPending}
                >
                  {deleteEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Permanent Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditingAddress ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address-line1">Address Line 1</Label>
                    <Input id="address-line1" name="address-line1" value={editAddress?.address_line1 || ''} onChange={e => setEditAddress({ ...editAddress, address_line1: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address-line2">Address Line 2</Label>
                    <Input id="address-line2" name="address-line2" value={editAddress?.address_line2 || ''} onChange={e => setEditAddress({ ...editAddress, address_line2: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" name="city" value={editAddress?.city || ''} onChange={e => setEditAddress({ ...editAddress, city: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" name="state" value={editAddress?.state || ''} onChange={e => setEditAddress({ ...editAddress, state: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input id="pincode" name="pincode" value={editAddress?.pincode || ''} onChange={e => setEditAddress({ ...editAddress, pincode: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" name="country" value={editAddress?.country || 'India'} onChange={e => setEditAddress({ ...editAddress, country: e.target.value })} />
                  </div>
                </div>

                {/* Map Preview */}
                <div className="space-y-2">
                  <Label>Map Preview</Label>
                  <div className="border rounded-lg overflow-hidden h-[300px] bg-muted relative">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(
                        [
                          editAddress?.address_line1,
                          editAddress?.city,
                          editAddress?.state,
                          editAddress?.pincode,
                          editAddress?.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Vrindavan, Mathura"
                      )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      title="Map Preview"
                    ></iframe>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    Preview updates as you type (unsaved changes)
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="google-maps-link">Google Maps Link (for external redirection)</Label>
                  <Input id="google-maps-link" name="google-maps-link" value={editAddress?.google_maps_link || ''} onChange={e => setEditAddress({ ...editAddress, google_maps_link: e.target.value })} placeholder="https://maps.google.com/..." />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdateAddress} size="sm" disabled={updateAddressMutation.isPending}>
                  {updateAddressMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Address
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditAddress(address);
                    setIsEditingAddress(false);
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="whitespace-pre-wrap font-medium">{formatAddress(address)}</p>
                {address?.google_maps_link && (
                  <a href={address.google_maps_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-2 block">
                    View on Google Maps
                  </a>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setIsEditingAddress(true)}
                size="sm"
              >
                Edit Address
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
