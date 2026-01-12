import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/authStore";
import { donationService } from "@/services/donation.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, ShieldCheck, Lock } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getErrorMessage } from "@/lib/errorUtils";

export const DonationForm = () => {
    const { t } = useTranslation();
    const { user } = useAuthStore();

    // States
    const [donationType, setDonationType] = useState<"one_time" | "monthly">("one_time");
    const [amount, setAmount] = useState<string>("");
    const [customAmount, setCustomAmount] = useState<string>("");

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: ""
    });

    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [statusDialog, setStatusDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        type: "success" | "error";
    }>({
        open: false,
        title: "",
        message: "",
        type: "success"
    });

    // Pre-fill user data
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                fullName: user.name || "",
                email: user.email || "",
                phone: user.phone || ""
            }));
        }
    }, [user]);

    const handleAmountSelect = (val: string) => {
        setAmount(val);
        setCustomAmount("");
    };

    const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, "");
        setCustomAmount(val);
        setAmount(val);
    };

    const handleDonate = async () => {
        const finalAmount = parseInt(amount);
        if (!finalAmount || finalAmount < 1) {
            setStatusDialog({
                open: true,
                title: "Invalid Amount",
                message: "Please enter a valid donation amount.",
                type: "error"
            });
            return;
        }

        if (!formData.fullName || !formData.email || !formData.phone) {
            setStatusDialog({
                open: true,
                title: "Missing Details",
                message: "Please fill in your details.",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            if (donationType === "one_time") {
                // One-time donation flow
                const orderData = await donationService.createOrder({
                    amount: finalAmount,
                    donorName: formData.fullName,
                    donorEmail: formData.email,
                    donorPhone: formData.phone,
                    isAnonymous: false
                });

                const options = {
                    key: orderData.key_id,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: "Merigaumata Donation",
                    description: `Ref: ${orderData.donation_ref}`,
                    order_id: orderData.order_id,
                    handler: async (response: {
                        razorpay_order_id: string;
                        razorpay_payment_id: string;
                        razorpay_signature: string;
                    }) => {
                        // Show loading overlay during verification
                        setLoadingMessage("Verifying your donation...");
                        setLoading(true);
                        try {
                            await donationService.verifyPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                donation_ref: orderData.donation_ref
                            });

                            setLoading(false);
                            setLoadingMessage("");
                            setStatusDialog({
                                open: true,
                                title: "Thank You!",
                                message: "Your donation has been received successfully. A receipt has been sent to your email.",
                                type: "success"
                            });
                            setAmount("");
                            setCustomAmount("");
                        } catch (err) {
                            setLoading(false);
                            setLoadingMessage("");
                            setStatusDialog({
                                open: true,
                                title: "Verification Failed",
                                message: "Payment was successful but verification failed. Please contact support.",
                                type: "error"
                            });
                        }
                    },
                    prefill: {
                        name: formData.fullName,
                        email: formData.email,
                        contact: formData.phone
                    },
                    theme: {
                        color: "#C8815F"
                    }
                };

                const rzp = new window.Razorpay(options);
                rzp.on('payment.failed', () => {
                    setLoading(false);
                    setLoadingMessage("");
                    setStatusDialog({
                        open: true,
                        title: "Payment Failed",
                        message: "Your payment could not be processed. Please try again.",
                        type: "error"
                    });
                });
                setLoading(false); // Stop button loading, popup is open
                rzp.open();
            } else {
                // Monthly Subscription Flow
                const subscriptionData = await donationService.createSubscription({
                    amount: finalAmount,
                    donorName: formData.fullName,
                    donorEmail: formData.email,
                    donorPhone: formData.phone,
                    isAnonymous: false
                });

                const options = {
                    key: subscriptionData.key_id,
                    subscription_id: subscriptionData.subscription_id,
                    name: "Cow Welfare Donation",
                    description: `Monthly Donation: ₹${finalAmount}`,
                    handler: async (_response: unknown) => {
                        // Subscription created successfully.
                        // Webhook will handle the actual payment success and DB update for the first charge.
                        setStatusDialog({
                            open: true,
                            title: "🎉 Subscription Started!",
                            message: "Your monthly donation has been set up successfully! Thank you for your sustained support. You can view, pause, or cancel your subscription anytime from your Profile → Donations tab.",
                            type: "success"
                        });
                        setAmount("");
                        setCustomAmount("");
                    },
                    prefill: {
                        name: formData.fullName,
                        email: formData.email,
                        contact: formData.phone
                    },
                    theme: {
                        color: "#C8815F"
                    }
                };

                const rzp = new window.Razorpay(options);
                rzp.on('payment.failed', () => {
                    setStatusDialog({
                        open: true,
                        title: "Payment Failed",
                        message: "Your payment could not be processed. Please try again.",
                        type: "error"
                    });
                });
                setLoading(false); // Stop button loading, popup is open
                rzp.open();
            }
        } catch (error: unknown) {
            setStatusDialog({
                open: true,
                title: "Error",
                message: getErrorMessage(error, "Failed to initiate donation."),
                type: "error"
            });
            setLoading(false);
            setLoadingMessage("");
        }
    };

    return (
        <>
            {/* Full-page loading overlay */}
            <LoadingOverlay isLoading={loading && !!loadingMessage} message={loadingMessage} />

            <div className="w-full max-w-2xl mx-auto">
                <Card>
                    <CardContent className="p-6 space-y-6">
                        <div className="text-center space-y-2">
                            <Heart className="w-12 h-12 text-primary mx-auto" />
                            <h2 className="text-2xl font-bold">Make a Donation</h2>
                            <p className="text-muted-foreground">Your contribution changes lives.</p>
                        </div>

                        <Tabs value={donationType} onValueChange={(v) => setDonationType(v as "one_time" | "monthly")}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="one_time">One-Time</TabsTrigger>
                                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="space-y-4">
                            <Label>Select Amount</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {["500", "1000", "5000"].map((val) => (
                                    <Button
                                        key={val}
                                        variant={amount === val ? "default" : "outline"}
                                        onClick={() => handleAmountSelect(val)}
                                        className="h-12 text-lg"
                                    >
                                        ₹{val}
                                    </Button>
                                ))}
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-muted-foreground">₹</span>
                                <Input
                                    placeholder="Enter custom amount"
                                    className="pl-8 h-12 text-lg"
                                    value={customAmount}
                                    onChange={handleCustomAmountChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="font-semibold">Your Details</h3>

                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="Enter your email"
                                        type="email"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <PhoneInput
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(val) => setFormData({ ...formData, phone: val })}
                                        label="Phone Number"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            className="w-full text-lg h-14"
                            onClick={handleDonate}
                            disabled={loading}
                        >
                            {loading ? "Processing..." : `Donate ₹${amount || "0"}`}
                        </Button>

                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Secure payment by Razorpay</span>
                            <Lock className="w-4 h-4 ml-2" />
                            <span>256-bit SSL Encrypted</span>
                        </div>
                    </CardContent>
                </Card>

                <AlertDialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog(prev => ({ ...prev, open: false }))}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className={statusDialog.type === "error" ? "text-destructive" : "text-primary"}>
                                {statusDialog.title}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {statusDialog.message}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction onClick={() => setStatusDialog(prev => ({ ...prev, open: false }))}>
                                OK
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    );
};
