import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { checkoutService } from "@/services/checkout.service";
import { AddressSelector } from "@/components/checkout/AddressSelector";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { PriceBreakdown } from "@/components/checkout/PriceBreakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { CheckoutSummary, CheckoutAddress } from "@/types";
import { getErrorMessage } from "@/lib/errorUtils";
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

export default function Checkout() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { fetchCart } = useCartStore();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);

  const [shippingAddress, setShippingAddress] = useState<CheckoutAddress | null>(null);
  const [billingAddress, setBillingAddress] = useState<CheckoutAddress | null>(null);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [showPhoneWarning, setShowPhoneWarning] = useState(false);

  // Moved fetchCheckoutSummary definition up
  const fetchCheckoutSummary = useCallback(async () => {
    try {
      setLoading(true);
      const data = await checkoutService.getSummary();

      if (!data.cart || !data.cart.cart_items || data.cart.cart_items.length === 0) {
        toast.error("Your cart is empty");
        navigate("/cart");
        return;
      }

      setSummary(data);

      // Pre-select addresses if available
      if (data.shipping_address) setShippingAddress(data.shipping_address);
      if (data.billing_address) setBillingAddress(data.billing_address);

    } catch (error) {
      logger.error("Checkout error", error);
      toast.error("Failed to load checkout details");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      toast.error("Please login to checkout");
      navigate("/auth?returnUrl=/checkout");
      return;
    }
    fetchCheckoutSummary();
  }, [isAuthenticated, navigate, fetchCheckoutSummary]);

  const handlePayment = async () => {
    if (!shippingAddress) {
      toast.error("Please select a shipping address");
      return;
    }

    // Validate phone number
    if (!shippingAddress.phone || shippingAddress.phone.trim() === '') {
      setShowPhoneWarning(true);
      return;
    }

    if (!billingSameAsShipping && !billingAddress) {
      toast.error("Please select a billing address");
      return;
    }

    if (!summary) return;

    try {
      setProcessing(true);

      // 1. Create Payment Order on Backend
      const orderData = await checkoutService.createPaymentOrder(summary.totals.finalAmount);

      // 2. Initialize Razorpay Options
      const options = {
        key: orderData.key_id, // Enter the Key ID generated from the Dashboard
        amount: orderData.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
        currency: orderData.currency,
        name: "MeriGauMata",
        description: "Order Payment",
        image: "https://lovable.dev/opengraph-image-p98pqg.png", // Optional: Add your logo
        order_id: orderData.order_id, // This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          // Show full screen loader during verification
          setLoading(true);
          setProcessing(true);

          try {
            // 3. Verify Payment on Backend
            const result = await checkoutService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              payment_id: orderData.payment_id,
              shipping_address_id: shippingAddress.id,
              billing_address_id: billingSameAsShipping ? shippingAddress.id : billingAddress!.id,
            });

            if (result.success) {
              // Refresh cart to clear items from UI (backend already cleared it)
              await fetchCart();
              toast.success("Order placed successfully!");
              navigate(`/order-confirmation/${result.order.id}`, { state: { order: result.order } });
            }
          } catch (error: unknown) {
            logger.error("Order creation error", error);

            // User friendly error message
            let userMsg = "Payment verified but order creation failed. Please contact support.";
            const serverMsg = getErrorMessage(error);

            if (serverMsg && (serverMsg.includes('refunded') || serverMsg.includes('Order creation failed'))) {
              userMsg = "Payment successful but order creation failed. \nYour payment has been automatically refunded. \nPlease try again.";
            }

            toast.error(userMsg, { duration: 6000 });
          } finally {
            setProcessing(false);
            setLoading(false);
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: shippingAddress.phone || "",
        },
        notes: {
          address: "Razorpay Corporate Office",
        },
        theme: {
          color: "#16a34a",
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
            toast("Payment cancelled");
          }
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: { error: { description: string } }) {
        logger.error("Payment failed", response.error);
        toast.error(`Payment Failed: ${response.error.description || "Unknown error"}`);
        setProcessing(false);
      });
      rzp1.open();

      // Fix for accessibility error: blocked aria-hidden on focused element
      // Remove aria-hidden from razorpay container if it exists
      const fixRazorpayAccessibility = setInterval(() => {
        const container = document.querySelector('.razorpay-container');
        if (container) {
          const isHidden = container.getAttribute('aria-hidden');
          if (isHidden === 'true') {
            container.removeAttribute('aria-hidden');
            // logger.debug('Removed aria-hidden from Razorpay container');
          }
        }
        // Also check if focus is lost or trapped incorrectly
      }, 200);

      // Stop checking after 10 seconds (modal should be loaded by then)
      setTimeout(() => clearInterval(fixRazorpayAccessibility), 10000);

    } catch (error) {
      logger.error("Payment initiation error", error);
      toast.error("Failed to initiate payment. Please try again.");
      setProcessing(false);
    }
  };

  if (loading && !summary) {
    return <LoadingOverlay isLoading={true} message="Loading checkout details..." />;
  }

  if (!summary) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <LoadingOverlay
        isLoading={processing && loading}
        message="Verifying payment and creating order..."
      />
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Addresses */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddressSelector
                type="shipping"
                selectedAddressId={shippingAddress?.id}
                onSelect={setShippingAddress}
              />
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                Billing Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="billing-same"
                  checked={billingSameAsShipping}
                  onCheckedChange={(checked) => setBillingSameAsShipping(checked as boolean)}
                />
                <Label htmlFor="billing-same" className="cursor-pointer">
                  Same as shipping address
                </Label>
              </div>

              {!billingSameAsShipping && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                  <AddressSelector
                    type="billing"
                    selectedAddressId={billingAddress?.id}
                    onSelect={setBillingAddress}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Order Summary */}
        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <OrderSummary items={summary.cart.cart_items.map((item) => ({
                ...item,
                productId: item.product_id,
                product: item.products
              }))} />

              <Separator />

              <PriceBreakdown totals={summary.totals} />

              <Button
                className="w-full h-12 text-lg"
                onClick={handlePayment}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Pay ₹{summary.totals.finalAmount.toFixed(2)}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span>Secure Payment via Razorpay</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showPhoneWarning} onOpenChange={setShowPhoneWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phone Number Required</AlertDialogTitle>
            <AlertDialogDescription>
              A phone number is required for delivery coordination. Please edit your shipping address to include a valid phone number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowPhoneWarning(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
