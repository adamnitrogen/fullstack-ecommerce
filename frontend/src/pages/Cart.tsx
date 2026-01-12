import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Minus,
  Plus,
  X,
  ShoppingBag,
  Package,
  RotateCcw,
  Tag as TagIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tag } from "@/components/ui/Tag";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import AuthPage from "@/pages/Auth";
import { toast } from "sonner";

const DELIVERY_THRESHOLD = 1500; // Updated from 2000
const DELIVERY_CHARGE = 50;

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
  } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [couponCode, setCouponCode] = useState("");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // Fetch cart on mount
  useEffect(() => {
    if (isAuthenticated && !initialized) {
      fetchCart();
    }
  }, [isAuthenticated, initialized, fetchCart]);

  // Calculate pricing helper
  const calculateDiscount = (mrp: number, price: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    await applyCoupon(couponCode);
    setCouponCode("");
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
  };

  const handlePlaceOrder = () => {
    if (!isAuthenticated) {
      setAuthDialogOpen(true);
      return;
    }
    navigate("/checkout");
  };

  if (isLoading && !initialized) {
    return (
      <div className="min-h-screen bg-background py-16 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ShoppingBag className="h-24 w-24 mx-auto text-muted-foreground mb-6" />
          <h1 className="text-3xl font-bold mb-4">{t("cart.empty")}</h1>
          <p className="text-muted-foreground mb-8">
            Looks like you haven't added any items to your cart yet
          </p>
          <Link to="/shop">
            <Button variant="default" size="lg">
              {t("cart.continue")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8">{t("cart.title")}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const itemMRP = item.product.mrp || item.product.price;
              const itemDiscount = item.product.mrp
                ? calculateDiscount(item.product.mrp, item.product.price)
                : 0;
              const hasDiscount = itemMRP > item.product.price;

              return (
                <Card key={item.productId}>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <Link to={`/product/${item.productId}`}>
                        <img
                          src={item.product.images[0]}
                          alt={item.product.title}
                          loading="lazy"
                          className="w-20 h-20 md:w-28 md:h-28 object-cover rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
                        />
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 pr-2">
                            <Link to={`/product/${item.productId}`}>
                              <h3 className="font-semibold text-base md:text-lg hover:text-primary transition-colors line-clamp-1">
                                {item.product.title}
                              </h3>
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <Tag variant="category" size="sm">
                                {item.product.category}
                              </Tag>
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-muted-foreground hover:text-destructive transition-smooth flex-shrink-0"
                            aria-label="Remove item"
                            disabled={isLoading}
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        {/* Short Description */}
                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-3">
                          {item.product.description}
                        </p>

                        {/* Price Details */}
                        <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                          <p className="text-lg md:text-xl font-bold text-primary">
                            ₹{item.product.price}
                          </p>
                          {hasDiscount && (
                            <>
                              <p className="text-sm text-muted-foreground line-through">
                                ₹{itemMRP}
                              </p>
                              <Tag variant="discount" size="sm">
                                {itemDiscount}% OFF
                              </Tag>
                            </>
                          )}
                        </div>

                        {/* Return Policy & Quantity Controls */}
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          {/* Return Info */}
                          <div className="flex items-center gap-4 text-xs md:text-sm">
                            {item.product.isReturnable ? (
                              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                <span className="font-medium">
                                  {item.product.returnDays} days return
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Package className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                <span>Non-returnable</span>
                              </div>
                            )}
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-3 border border-border rounded-lg p-1">
                            <button
                              onClick={() => {
                                if (item.quantity > 1) {
                                  updateQuantity(item.productId, item.quantity - 1);
                                } else {
                                  removeItem(item.productId);
                                }
                              }}
                              className="p-1 hover:bg-muted rounded transition-smooth"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity + 1)
                              }
                              className="p-1 hover:bg-muted rounded transition-smooth"
                              disabled={
                                item.product.inventory !== undefined &&
                                item.quantity >= item.product.inventory
                              }
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Item Total */}
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Item Total:
                            </span>
                            <span className="text-lg font-bold text-primary">
                              ₹{item.product.price * item.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Price Details */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-xl">Price Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Breakdown */}
                <div className="space-y-3">
                  {/* Total MRP */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Items Price ({totals?.itemsCount || items.length}{" "}
                      {(totals?.itemsCount || items.length) === 1
                        ? "item"
                        : "items"}
                      )
                    </span>
                    <span className="font-medium">₹{totals?.totalMrp || 0}</span>
                  </div>

                  {/* Discount */}
                  {totals && totals.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Discount Price
                      </span>
                      <span className="font-medium text-green-600">
                        −₹{totals.discount}
                      </span>
                    </div>
                  )}

                  {/* Delivery Charges */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Delivery Charges
                      {totals && totals.totalPrice < DELIVERY_THRESHOLD && (
                        <span className="block text-xs mt-0.5">
                          (Free above ₹{DELIVERY_THRESHOLD})
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {totals?.deliveryCharge === 0 ? (
                        <span className="text-green-600">Free</span>
                      ) : (
                        `₹${totals?.deliveryCharge || 0}`
                      )}
                    </span>
                  </div>

                  {/* Coupon Discount */}
                  {totals?.coupon && totals.couponDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Coupon ({totals.coupon.code})
                      </span>
                      <span className="font-medium text-green-600">
                        −₹{totals.couponDiscount}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Coupon Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Apply Coupon</span>
                  </div>
                  {totals?.coupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag variant="success" size="sm">
                          {totals.coupon.code}
                        </Tag>
                        <span className="text-xs text-green-700 dark:text-green-300">
                          Applied
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveCoupon}
                        className="h-7 text-xs"
                        disabled={isLoading}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="coupon-code"
                        name="coupon-code"
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) =>
                          setCouponCode(e.target.value.toUpperCase())
                        }
                        className="flex-1"
                        disabled={isLoading}
                      />
                      <Button
                        variant="outline"
                        onClick={handleApplyCoupon}
                        disabled={!couponCode || isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Order Total */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-bold">Order Total</span>
                    <span className="text-2xl font-bold text-primary">
                      ₹{totals?.finalAmount || 0}
                    </span>
                  </div>

                  {totals && totals.discount + totals.couponDiscount > 0 && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                        You saved ₹{totals.discount + totals.couponDiscount} on
                        this order!
                      </p>
                    </div>
                  )}

                  <Button
                    variant="default"
                    className="w-full mb-3"
                    size="lg"
                    onClick={handlePlaceOrder}
                    disabled={isLoading}
                  >
                    Place Order
                  </Button>

                  <Link to="/shop" className="block">
                    <Button variant="outline" className="w-full">
                      {t("cart.continue")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};

export default Cart;
