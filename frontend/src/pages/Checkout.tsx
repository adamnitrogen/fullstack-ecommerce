import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { checkoutService } from "@/services/checkout.service";
import { AddressSelector } from "@/components/checkout/AddressSelector";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { PriceBreakdown } from "@/components/checkout/PriceBreakdown";
import { OutOfStockModal } from "@/components/checkout/OutOfStockModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Lock, ShieldCheck, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { loadRazorpay, prefetchRazorpay } from "@/lib/razorpay";
import type { CheckoutSummary, CheckoutAddress, Product } from "@/types";
import { getErrorMessage, isNetworkError } from "@/lib/errorUtils";
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
import { BackButton } from "@/components/ui/BackButton";


// Type for Buy Now navigation state
interface BuyNowState {
  buyNowItem?: {
    product: Product;
    quantity: number;
    variantId?: string;
  };
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const { fetchCart } = useCartStore();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);

  // Buy Now state
  const [isBuyNow, setIsBuyNow] = useState(false);
  const [buyNowData, setBuyNowData] = useState<{
    productId: string;
    variantId?: string;
    quantity: number;
  } | null>(null);

  const [shippingAddress, setShippingAddress] = useState<CheckoutAddress | null>(null);
  const [billingAddress, setBillingAddress] = useState<CheckoutAddress | null>(null);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [showPhoneWarning, setShowPhoneWarning] = useState(false);
  const [addressIdToEdit, setAddressIdToEdit] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<Array<{
    productId: string;
    variantId: string | null;
    title: string;
    variantLabel: string | null;
    requestedQty: number;
    availableStock: number;
    image: string | null;
  }>>([]);
  const [showStockModal, setShowStockModal] = useState(false);

  // Moved fetchCheckoutSummary definition up
  const fetchCheckoutSummary = useCallback(async (addressId?: string) => {
    try {
      setLoading(true);
      const data = await checkoutService.getSummary(addressId);

      if (!data.cart || !data.cart.cart_items || data.cart.cart_items.length === 0) {
        toast.error("Your cart is empty");
        navigate("/cart");
        return;
      }

      setSummary(data);

      // Sync global cart store to ensure Navbar count is accurate
      // This handles cases where user navigates directly to checkout or hard refreshes
      fetchCart();

      // Pre-select addresses if available, but DON'T overwrite if we specifically requested an address (user selection)
      // This prevents race conditions where backend fallback logic reverts the user's selection
      if (data.shipping_address && !addressId) {
        const newShipping = data.shipping_address;
        setShippingAddress(prev => {
          // Only update if current is null or ID differs
          if (!prev || prev.id !== newShipping.id) {
            return newShipping;
          }
          return prev;
        });
      }
      if (data.billing_address) {
        const newBilling = data.billing_address;
        setBillingAddress(prev => {
          if (!prev || prev.id !== newBilling.id) {
            return newBilling;
          }
          return prev;
        });
      }

    } catch (error) {
      logger.error("Checkout error", error);
      toast.error("Failed to load checkout details");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const initCheckout = async () => {
      if (!isAuthenticated) {
        toast.error("Please login to checkout");
        navigate("/auth?returnUrl=/checkout");
        return;
      }

      // If we are already in Buy Now mode (e.g. after state clear), don't fallback to cart
      if (isBuyNow) return;

      // Check for Buy Now flow
      const state = location.state as BuyNowState | undefined;
      if (state?.buyNowItem) {
        const { product, quantity, variantId } = state.buyNowItem;

        // Set Buy Now mode
        setIsBuyNow(true);
        const buyNowInfo = {
          productId: product.id,
          variantId: variantId,
          quantity
        };
        setBuyNowData(buyNowInfo);

        // Clear the state to prevent re-loading on refresh
        navigate(location.pathname, { replace: true, state: {} });

        // Fetch Buy Now summary (not cart-based)
        try {
          setLoading(true);
          const data = await checkoutService.getSummaryForBuyNow(buyNowInfo);
          setSummary(data);

          // Pre-select addresses if available
          // Pre-select addresses if available
          if (data.shipping_address) {
            const newShipping = data.shipping_address;
            setShippingAddress(prev => prev?.id === newShipping.id ? prev : newShipping);
          }
          if (data.billing_address) {
            const newBilling = data.billing_address;
            setBillingAddress(prev => prev?.id === newBilling.id ? prev : newBilling);
          }

          // Prefetch Razorpay SDK in background (non-blocking)
          prefetchRazorpay();
        } catch (error) {
          logger.error("Buy Now checkout error", error);
          const errorMsg = getErrorMessage(error) || "Unable to load checkout. Please try again.";
          toast.error(errorMsg);
          navigate("/shop");
        } finally {
          setLoading(false);
        }
        return;
      }

      // Regular cart checkout flow
      fetchCheckoutSummary();
    };

    initCheckout();
  }, [isAuthenticated, navigate, fetchCheckoutSummary, location]);

  // Prefetch Razorpay SDK after summary loads (non-blocking)
  useEffect(() => {
    if (summary && !loading) {
      prefetchRazorpay();
    }
  }, [summary, loading]);

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

      // PHASE 2B OPTIMIZATION: Stock validation now inline for both Buy Now AND Cart
      // No separate validation API call needed - backend validates during payment creation

      // 1. Create Payment Order on Backend (stock validation inline)
      let orderData;
      try {
        if (isBuyNow && buyNowData) {
          orderData = await checkoutService.createPaymentOrderForBuyNow(buyNowData);
        } else {
          // PHASE 3A: Pass profile from summary to avoid duplicate fetch
          // Pass shippingAddress.id to ensure backend calculates delivery/tax correctly for THIS address
          orderData = await checkoutService.createPaymentOrder(
            summary.totals.finalAmount,
            summary.user_profile,
            shippingAddress?.id
          );
        }
      } catch (error: any) {
        // Handle inline stock validation failures from payment creation
        if (error?.response?.data?.stockIssue && isBuyNow) {
          // Buy Now single item failure
          const stockIssue = error.response.data.stockIssue;
          const errorMsg = error.response.data.error || '';

          // Extract product title from error message
          const titleMatch = errorMsg.match(/Sorry, (.+?) is/);
          const productTitle = titleMatch ? titleMatch[1] : 'Product';

          setStockIssues([{
            productId: stockIssue.productId,
            variantId: stockIssue.variantId || null,
            title: productTitle,
            variantLabel: null,
            requestedQty: stockIssue.requestedQty,
            availableStock: stockIssue.availableStock,
            image: null
          }]);
          setShowStockModal(true);
          setProcessing(false);
          return;
        } else if (error?.response?.data?.stockIssues) {
          // Cart multiple items failure  
          setStockIssues(error.response.data.stockIssues);
          setShowStockModal(true);
          setProcessing(false);
          return;
        }
        // Re-throw other errors to be handled by outer catch
        throw error;
      }

      // 2. Ensure Razorpay SDK is loaded (verify preload or load now)
      if (!window.Razorpay) {
        const isLoaded = await loadRazorpay();
        if (!isLoaded) {
          toast.error("Failed to load payment gateway. Please check your connection.");
          setProcessing(false);
          return;
        }
      }

      // 3. Initialize Razorpay Options
      const options = {
        key: summary.razorpay_key_id || orderData.key_id, // PHASE 2B: Use key from summary (fallback to orderData for compatibility)
        amount: orderData.amount,
        currency: orderData.currency,
        name: "MeriGauMata",
        description: isBuyNow ? "Buy Now Order" : "Order Payment",
        image: "/favicon.ico", // Note: Will cause CORS warning on localhost, but works in production via public URL. For dev, consider using absolute URL if needed.
        order_id: orderData.order_id,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          // Show full screen loader during verification
          setLoading(true);
          setProcessing(true);

          try {
            // 3. Verify Payment on Backend (different endpoints for buy now vs cart)
            let result;
            if (isBuyNow && buyNowData) {
              result = await checkoutService.verifyPaymentForBuyNow({
                razorpay_order_id: response.razorpay_order_id || orderData.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_id: orderData.payment_id,
                shipping_address_id: shippingAddress.id,
                billing_address_id: billingSameAsShipping ? shippingAddress.id : billingAddress!.id,
                buyNowData
              });
            } else {
              result = await checkoutService.verifyPayment({
                razorpay_order_id: response.razorpay_order_id || orderData.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_id: orderData.payment_id,
                shipping_address_id: shippingAddress.id,
                billing_address_id: billingSameAsShipping ? shippingAddress.id : billingAddress!.id,
              });
            }


            // Always refresh cart to reflect changes (Buy Now might remove items, Regular clears cart)
            await fetchCart();

            if (result.success) {
              toast.success("Order placed successfully!");
              navigate(`/order-confirmation/${result.order.id}`, { state: { order: result.order } });
            }
          } catch (error: unknown) {
            logger.error("Order creation error", error);

            if (isNetworkError(error)) {
              toast.error(
                "Network Error: Payment was successful but order verification timed out. Please DO NOT retry. Your order will be processed shortly. Contact support if you don't receive an email within 10 minutes.",
                { duration: 10000 }
              );
            } else {
              // Use server error message - it's now user-friendly
              const serverMsg = getErrorMessage(error);

              // The backend now provides user-friendly messages
              let userMsg = serverMsg || "Unable to complete your order. Please try again or contact support.";

              // Extend duration for important messages
              const duration = serverMsg?.includes('refund') || serverMsg?.includes('contact support') ? 8000 : 5000;

              toast.error(userMsg, { duration });
            }
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
      const serverMsg = getErrorMessage(error);
      toast.error(serverMsg || "Failed to initiate payment. Please try again.");
      setProcessing(false);
    }
  };

  if (loading && !summary) {
    return <LoadingOverlay isLoading={true} message="Preparing your checkout..." />;
  }

  if (!summary) return null;

  // Prepare cart items with delivery details embedded
  const cartItems = summary.cart.cart_items.map((item) => {
    const itemDetail = summary.totals.itemBreakdown?.find((id: any) =>
      (id.variant_id && id.variant_id === item.variant_id) ||
      (!id.variant_id && id.product_id === item.product_id)
    );

    return {
      ...item,
      productId: item.product_id,
      product: item.products,
      variant: item.product_variants,
      delivery_charge: itemDetail?.delivery_charge || 0,
      delivery_gst: itemDetail?.delivery_gst || 0,
      delivery_meta: itemDetail?.delivery_meta
    };
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <LoadingOverlay
        isLoading={processing && loading}
        message="Placing your order..."
      />

      {/* Compact Premium Hero Section */}
      <section className="bg-[#2C1810] text-white py-12 relative overflow-hidden shadow-2xl mb-8">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <ShoppingBag className="h-48 w-48 text-[#B85C3C]" />
        </div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#B85C3C]/10 rounded-full blur-[100px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <BackButton to="/cart" label="Back to Cart" className="text-white/80 hover:text-white hover:bg-white/10" />
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-bold font-playfair">
                Secure <span className="text-[#B85C3C]">Checkout</span>
              </h1>
              <p className="text-white/60 text-sm font-light">
                Complete your purchase to support our mission
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="space-y-8">
          {/* Top Section: Order Items */}
          <Card className="border-none shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Items in your Order
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <OrderSummary items={cartItems} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column - Addresses */}
            <div className="lg:col-span-8 space-y-8">
              {/* Shipping Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">
                      1
                    </div>
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <AddressSelector
                    type="shipping"
                    selectedAddressId={shippingAddress?.id}
                    onSelect={(address) => {
                      // Only refetch if address actually changed
                      if (shippingAddress?.id !== address.id) {
                        setShippingAddress(address);
                        fetchCheckoutSummary(address.id);
                      }
                    }}
                    forceEditId={addressIdToEdit}
                    onEditOpened={() => setAddressIdToEdit(null)}
                  />
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">
                      2
                    </div>
                    Billing Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center space-x-3 bg-muted/20 p-4 rounded-lg border border-border/50">
                    <Checkbox
                      id="billing-same"
                      checked={billingSameAsShipping}
                      onCheckedChange={(checked) => setBillingSameAsShipping(checked as boolean)}
                    />
                    <Label htmlFor="billing-same" className="cursor-pointer font-medium">
                      Same as shipping address
                    </Label>
                  </div>

                  {!billingSameAsShipping && (
                    <div className="animate-in fade-in slide-in-from-top-2 pt-2">
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
            <div className="lg:col-span-4 space-y-6">
              <div className="sticky top-24 space-y-6">
                <Card className="border-none shadow-elevated overflow-hidden">
                  <CardContent className="p-6 space-y-2">
                    <PriceBreakdown totals={summary.totals} items={cartItems} />

                    <Button
                      className="w-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
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

                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/30 py-2 rounded-full">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Secure Payment via Razorpay</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <AlertDialog open={showPhoneWarning} onOpenChange={setShowPhoneWarning}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-playfair text-2xl text-destructive">Phone Number Required</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                To ensure smooth delivery, we need a valid phone number. Please update your shipping address to include a contact number.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => {
                if (shippingAddress) setAddressIdToEdit(shippingAddress.id);
                setShowPhoneWarning(false);
              }} className="rounded-full px-6">
                OK, I'll add it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <OutOfStockModal
          open={showStockModal}
          onClose={() => setShowStockModal(false)}
          items={stockIssues}
        />
      </div>
    </div>
  );
}
