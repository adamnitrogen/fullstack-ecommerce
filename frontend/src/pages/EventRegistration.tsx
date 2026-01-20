import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Banknote, ArrowLeft, Loader2, User, Mail, Phone, Ticket, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { eventService } from "@/services/event.service";
import { useAuthStore } from "@/store/authStore";

import { apiClient } from "@/lib/api-client";
import { PhoneInput } from "@/components/ui/phone-input";
import { getErrorMessage } from "@/lib/errorUtils";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

const EventRegistration = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "loading";
    data?: {
      registrationNumber: string;
      eventTitle: string;
      amount: string | number;
      email: string;
    };
    onClose?: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    type: "success",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventService.getById(eventId || ""),
    enabled: !!eventId,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  // Early return for loading state
  if (isLoading) {
    return <LoadingOverlay isLoading={true} message="Getting event details..." />;
  }

  // Early return if event not found
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

  // Extract event data - TypeScript now knows event exists due to the guard above
  const eventData = event;
  const registrationAmount = eventData.registrationAmount || 0;
  const isFree = registrationAmount === 0;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.phone || formData.phone.trim().length < 13) {
      newErrors.phone = "Phone number is required and must be 10 digits";
    }

    if (!agreedToTerms) {
      newErrors.terms = "You must agree to the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.email || user.email.trim() === "") {
      setErrors((prev) => ({
        ...prev,
        email:
          "Please add your email address in profile settings before registering for an event.",
      }));
      return;
    }

    if (validateForm()) {
      setShowConfirmDialog(true);
    }
  };


  // Helper to ensure dialog animations complete before opening the next one
  const switchDialogs = (nextDialogAction: () => void) => {
    setShowConfirmDialog(false);
    setTimeout(() => {
      nextDialogAction();
    }, 300); // Wait for close animation
  };

  const handleConfirmRegistration = async () => {
    setIsProcessing(true);

    // Keep dialog open while processing
    try {
      // Call backend to create order using apiClient for proper auth
      const response = await apiClient.post("/event-registrations/create-order", {
        eventId,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
      });

      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || "Failed to create registration");
      }

      // Handle free event registration
      if (data.isFree) {
        switchDialogs(() => setStatusDialog({
          open: true,
          title: "Registration Successful!",
          message: "", // Message is now rendered via data
          type: "success",
          data: {
            registrationNumber: data.registration.registrationNumber,
            eventTitle: eventData.title,
            amount: "Free",
            email: formData.email
          },
          onClose: () => navigate("/events"),
        }));
        return;
      }

      // Handle paid event - open Razorpay
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "MeriGauMata",
        description: `Registration for ${eventData.title}`,
        order_id: data.order_id,
        handler: async function (paymentResponse: Record<string, unknown>) {
          // Show verifying spinner
          setStatusDialog({
            open: true,
            title: "Verifying Payment",
            message: "Please wait while we confirm your registration...",
            type: "loading"
          });

          // Verify payment using apiClient
          try {
            const verifyRes = await apiClient.post(
              "/event-registrations/verify-payment",
              {
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                registration_id: data.registration_id,
              }
            );

            const verifyData = verifyRes.data;

            if (verifyData.success) {
              setStatusDialog({
                open: true,
                title: "Payment Successful!",
                message: "", // Message is now rendered via data
                type: "success",
                data: {
                  registrationNumber: verifyData.registration.registrationNumber,
                  eventTitle: verifyData.registration.eventTitle,
                  amount: verifyData.registration.amount,
                  email: formData.email
                },
                onClose: () => navigate("/events"),
              });
            } else {
              throw new Error("Verification returned unsuccessful status");
            }
          } catch (verifyError: unknown) {
            logger.error("Verification error:", verifyError);

            // Determine user-friendly error message
            let userMessage = "We couldn't verify your payment. Please contact support.";
            const serverMsg = getErrorMessage(verifyError);

            // Handle specific refund cases
            if (serverMsg && (serverMsg.includes('refunded') || serverMsg.includes('Registration failed'))) {
              userMessage = "Payment was successful but registration failed. \n\nYour payment has been automatically refunded. \nPlease try registering again.";
            }

            setStatusDialog({
              open: true,
              title: "Registration Failed",
              message: userMessage,
              type: "error",
            });
          }
        },
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: "#C8815F",
        },
        modal: {
          ondismiss: function () {
            logger.debug("Payment modal closed");
            // If we are NOT in loading state (meaning payment hasn't started verification), reset processing
            // Use a timeout to check if the statusDialog was set to loading by the handler
            setTimeout(() => {
              setStatusDialog(prev => {
                if (prev.type !== 'loading' && prev.type !== 'success') {
                  setIsProcessing(false);
                  setShowConfirmDialog(false);
                }
                return prev;
              });
            }, 500);
          },
        },
      };

      // Close confirm dialog before opening Razorpay
      setShowConfirmDialog(false);

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();

      // Fix for accessibility error: blocked aria-hidden on focused element
      // Use MutationObserver for more reliable removal
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
            const target = mutation.target as HTMLElement;
            if (target.getAttribute('aria-hidden') === 'true') {
              target.removeAttribute('aria-hidden');
            }
          }
        });
      });

      // Observe the razorpay container when it appears
      const startObserving = setInterval(() => {
        const container = document.querySelector('.razorpay-container');
        if (container) {
          // Remove any existing aria-hidden
          container.removeAttribute('aria-hidden');
          // Start observing for future changes
          observer.observe(container, { attributes: true, attributeFilter: ['aria-hidden'] });
          clearInterval(startObserving);
        }
      }, 100);

      // Cleanup after 30 seconds or when modal closes
      setTimeout(() => {
        clearInterval(startObserving);
        observer.disconnect();
      }, 30000);

    } catch (error: unknown) {
      logger.error("Registration error:", error);
      const errorMessage = getErrorMessage(error, "Failed to process registration. Please try again.");

      setIsProcessing(false); // Reset processing state on error
      setStatusDialog({
        open: true,
        title: "Registration Failed",
        message: errorMessage,
        type: "error",
      });
    } finally {
      // Don't set isProcessing false here for paid events because payment flow continues async
      // Handled in ondismiss or handler
      const isFree = event?.registrationAmount === 0;
      if (isFree) {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <LoadingOverlay
        isLoading={statusDialog.open && statusDialog.type === "loading"}
        message={statusDialog.message}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Title Section */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Registration</h1>
          <div className="w-20 h-1 bg-primary mx-auto"></div>
        </div>

        {/* Registration Card */}
        <Card className="overflow-hidden border-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left Side - Form */}
            <div className="p-6 bg-background">
              <h2 className="text-xl font-bold mb-5">Book Your Seat</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email ID</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email address"
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <PhoneInput
                    id="phone"
                    value={formData.phone}
                    onChange={(val) => {
                      setFormData((prev) => ({ ...prev, phone: val }));
                      if (errors.phone) {
                        setErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }}
                    error={errors.phone}
                    label="Phone No."
                    required={true}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone}</p>
                  )}
                </div>

                {/* Registration Amount Display */}
                <div className="space-y-2">
                  <Label>Registration Amount</Label>
                  <div className="bg-muted/50 p-4 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Amount:
                      </span>
                      <span className="text-lg font-bold">
                        {isFree ? "Free" : `₹${registrationAmount}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => {
                      setAgreedToTerms(checked as boolean);
                      if (errors.terms) {
                        setErrors((prev) => ({ ...prev, terms: "" }));
                      }
                    }}
                    className={errors.terms ? "border-destructive" : ""}
                  />
                  <Label htmlFor="terms" className="text-sm cursor-pointer">
                    I agree to the{" "}
                    <a
                      href="/terms-and-conditions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      terms & conditions
                    </a>
                  </Label>
                </div>
                {errors.terms && (
                  <p className="text-sm text-destructive">{errors.terms}</p>
                )}

                {/* Submit Button */}
                <Button type="submit" className="w-full" size="lg">
                  Confirm Registration
                </Button>
              </form>
            </div>

            {/* Right Side - Event Image */}
            <div className="relative h-full min-h-[500px] lg:min-h-0">
              {eventData.image ? (
                <img
                  src={eventData.image}
                  alt={eventData.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-center py-12">
                    <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No event image available
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Registration</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <User className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Name</p>
                      <p className="font-medium text-foreground">{formData.fullName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Mail className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</p>
                      <p className="font-medium text-foreground break-all">{formData.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Phone</p>
                      <p className="font-medium text-foreground">{formData.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Calendar className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Event</p>
                      <p className="font-medium text-foreground">{eventData.title}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-primary" />
                    <span className="font-medium">Total Amount</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    {isFree ? "Free" : `₹${registrationAmount}`}
                  </span>
                </div>

                {!isFree && (
                  <p className="text-xs text-center text-muted-foreground">
                    You will be redirected to the secure payment gateway to complete your registration.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => {
              if (isProcessing) {
                e.preventDefault(); // Prevent closing while processing
                return;
              }
              e.preventDefault(); // Take control of closing
              handleConfirmRegistration();
            }} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFree ? "Confirm Registration" : "Proceed to Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Dialog (Success/Error/Loading) */}
      <AlertDialog
        open={statusDialog.open && statusDialog.type !== "loading"}
        onOpenChange={(open) => {
          // Prevent closing if loading
          if (statusDialog.type === 'loading') return;
          if (!open) {
            setStatusDialog((prev) => ({ ...prev, open: false }));
            if (statusDialog.onClose) statusDialog.onClose();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className={
                statusDialog.type === "error" ? "text-destructive" : "text-primary"
              }
            >
              {statusDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="w-full">


                {statusDialog.type === 'error' && (
                  <div className="space-y-6 pt-2">
                    <div className="flex justify-center">
                      <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center">
                        <XCircle className="h-12 w-12 text-destructive" />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-lg font-semibold text-foreground">Registration Failed</p>
                      <p className="whitespace-pre-line text-muted-foreground">{statusDialog.message}</p>
                    </div>
                  </div>
                )}

                {statusDialog.type === 'success' && statusDialog.data && (
                  <div className="space-y-6 pt-2">
                    <div className="flex justify-center">
                      <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-muted-foreground">You have successfully registered for the event.</p>
                      <p className="text-sm text-muted-foreground">A confirmation email has been sent to <span className="font-medium text-foreground">{statusDialog.data.email}</span></p>
                    </div>

                    <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Registration ID</span>
                        <span className="font-mono font-medium">{statusDialog.data.registrationNumber}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Event</span>
                        <span className="font-medium text-right w-1/2">{statusDialog.data.eventTitle}</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between items-center">
                        <span className="font-medium text-primary">Amount Paid</span>
                        <span className="font-bold text-lg text-primary">
                          {typeof statusDialog.data.amount === 'number' ? `₹${statusDialog.data.amount}` : statusDialog.data.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {statusDialog.type !== 'loading' && (
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => {
                  setStatusDialog((prev) => ({ ...prev, open: false }));
                  if (statusDialog.onClose) statusDialog.onClose();
                }}
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
};

export default EventRegistration;
