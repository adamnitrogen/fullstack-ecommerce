import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import AuthPage from "@/pages/Auth";
import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/BackButton";
import { couponService } from "@/services/coupon.service";
import { Coupon } from "@/types";

const Cart = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    items,
    totals,
    isLoading,
    initialized,
    fetchCart,
    removeItem,
    updateQuantity,
    applyCoupon,
    removeCoupon,
    deliverySettings,
  } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);

  // Fetch cart on mount
  useEffect(() => {
    if (isAuthenticated && !initialized) {
      fetchCart();
    }
  }, [isAuthenticated, initialized, fetchCart]);

  // Fetch available coupons
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const coupons = await couponService.getActive();
        setAvailableCoupons(coupons);
      } catch (error) {
        console.error("Failed to fetch coupons:", error);
      }
    };
    fetchCoupons();
  }, []);

  const handlePlaceOrder = () => {
    if (!isAuthenticated) {
      setAuthDialogOpen(true);
      return;
    }
    navigate("/checkout");
  };

  const benefits = [
    {
      icon: <Truck className="w-6 h-6" />,
      title: "Fast Delivery",
      description: "Get your orders delivered within 2-4 business days."
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "Secure Payment",
      description: "100% secure payment processing with top-tier encryption."
    },
    {
      icon: <RotateCcw className="w-6 h-6" />,
      title: "Easy Returns",
      description: "Not satisfied? Return your items within 30 days easily."
    },
    {
      icon: <Headphones className="w-6 h-6" />,
      title: "24/7 Support",
      description: "Our dedicated support team is always here to help you."
    }
  ];

  // Loading state
  if (isLoading && !initialized) {
    return (
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-xl">
                  <Skeleton className="h-24 w-24 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-8 w-1/4 mt-2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loaded but empty
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <BackButton to="/shop" label={t("cart.continue")} />
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 animate-in fade-in duration-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight font-playfair">{t("cart.title")}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              You have {items.length} {items.length === 1 ? 'item' : 'items'} in your shopping bag
            </p>
          </div>
          <BackButton to="/shop" label="Continue Shopping" variant="pill" className="rounded-full px-6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            <div className="space-y-6">
              {items.map((item) => (
                <CartItem
                  key={item.productId}
                  item={item}
                  updateQuantity={updateQuantity}
                  removeItem={removeItem}
                  isLoading={isLoading}
                  isFreeDelivery={totals?.deliveryCharge === 0}
                />
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-dashed border-border/60 flex items-center justify-between">
              <p className="text-sm text-muted-foreground italic">
                * Prices are inclusive of all taxes
              </p>
            </div>
          </div>

          {/* Cart Summary Side Panel */}
          <div className="lg:col-span-1 relative lg:sticky lg:top-24">
            <CartSummary
              totals={totals}
              itemsCount={items.length}
              isLoading={isLoading}
              onApplyCoupon={applyCoupon}
              onRemoveCoupon={removeCoupon}
              isAuthenticated={isAuthenticated}
              onCheckout={handlePlaceOrder}
              availableCoupons={availableCoupons}
              deliverySettings={deliverySettings}
            />
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 border-t border-border/60 pt-16">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex flex-col items-center text-center space-y-4 p-6 rounded-3xl hover:bg-muted/50 transition-all group border border-transparent hover:border-border/50">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                {benefit.icon}
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm uppercase tracking-widest">{benefit.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed px-4">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};

export default Cart;
