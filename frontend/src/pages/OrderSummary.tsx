import { useLocation, useNavigate } from "react-router-dom";
import { MapPin, Package, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/authStore";
import { CartItem } from "@/types";

const DELIVERY_THRESHOLD = 2000;
const DELIVERY_CHARGE = 50;

const OrderSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const { addressId, orderDetails } = location.state || {};

  // Mock addresses - in real app, these would come from user profile
  const addresses = user?.addresses || [
    {
      id: "1",
      name: "Home",
      addressLine: "123 Main Street, Apartment 4B",
      city: "New Delhi",
      state: "Delhi",
      country: "India",
      pincode: "110001",
      isDefault: true,
    },
    {
      id: "2",
      name: "Office",
      addressLine: "456 Business Park, Tower A, Floor 5",
      city: "Gurugram",
      state: "Haryana",
      country: "India",
      pincode: "122001",
      isDefault: false,
    },
  ];

  const selectedAddress = addresses.find((addr) => addr.id === addressId);

  // Redirect if no order details
  if (!orderDetails || !selectedAddress) {
    navigate("/cart");
    return null;
  }

  const { items, totalMRP, totalPrice, discount, deliveryCharges, orderTotal } =
    orderDetails;

  const handleProceedToPayment = () => {
    // TODO: Integrate with Razorpay
    // For now, show alert
    alert("Razorpay integration pending. Order total: ₹" + orderTotal);

    // In production, this will redirect to Razorpay payment gateway
    // After successful payment, redirect to order confirmation page
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/checkout")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Checkout
        </Button>

        <h1 className="text-3xl font-bold mb-8">Order Summary</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Delivery Address
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/checkout")}
                  >
                    Change
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="font-semibold text-base">
                    {selectedAddress.name}
                  </p>
                  <p className="text-sm text-foreground">
                    {selectedAddress.addressLine}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAddress.city}, {selectedAddress.state} -{" "}
                    {selectedAddress.pincode}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAddress.country}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Items ({items.length}{" "}
                  {items.length === 1 ? "item" : "items"})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item: CartItem) => {
                  const itemMRP = item.product.mrp || item.product.price;
                  const hasDiscount = itemMRP > item.product.price;

                  return (
                    <div
                      key={item.productId}
                      className="flex gap-4 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <img
                        src={item.product.images[0]}
                        alt={item.product.title}
                        loading="lazy"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1 line-clamp-2">
                          {item.product.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2">
                          Qty: {item.quantity}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-base font-bold text-primary">
                            ₹{item.product.price * item.quantity}
                          </p>
                          {hasDiscount && (
                            <p className="text-xs text-muted-foreground line-through">
                              ₹{itemMRP * item.quantity}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right: Payment Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Items Price */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items Price</span>
                  <span className="font-medium">₹{totalMRP}</span>
                </div>

                {/* Discount */}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Discount Price
                    </span>
                    <span className="font-medium text-green-600">
                      −₹{discount}
                    </span>
                  </div>
                )}

                {/* Delivery Charges */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Delivery Charges
                    {totalPrice < DELIVERY_THRESHOLD && (
                      <span className="block text-xs mt-0.5">
                        (Free above ₹{DELIVERY_THRESHOLD})
                      </span>
                    )}
                  </span>
                  <span className="font-medium">
                    {deliveryCharges === 0 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      `₹${deliveryCharges}`
                    )}
                  </span>
                </div>

                <Separator />

                {/* Order Total */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-bold">Order Total</span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{orderTotal}
                  </span>
                </div>

                {/* Savings Info */}
                {discount > 0 && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                      You saved ₹{discount} on this order!
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleProceedToPayment}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Proceed to Payment
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  By proceeding, you agree to our Terms & Conditions
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
