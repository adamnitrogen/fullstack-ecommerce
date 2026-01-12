import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Star,
  ShoppingCart,
  Minus,
  Plus,
  Package,
  Zap,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/Tag";
import { Product } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

interface ProductDetailViewProps {
  product: Product;
  className?: string;
}

export const ProductDetailView = ({
  product,
  className = "",
}: ProductDetailViewProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const { user } = useAuthStore();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Check if product is in cart
  const cartItem = items.find((item) => item.productId === product.id);
  const quantity = cartItem?.quantity || 0;

  const handleAddToCart = () => {
    addItem(product);
    toast.success(`${product.title} added to cart`);
  };

  const handleBuyNow = async () => {
    if (!user?.email || user.email.trim() === "") {
      toast.error("Email Required", {
        description:
          "Please add your email address in profile settings before making a purchase.",
      });
      return;
    }
    // Add to cart if not already added
    if (!cartItem) {
      try {
        await addItem(product);
        toast.success(`${product.title} added to cart`);
      } catch (error) {
        toast.error("Failed to add item to cart");
        return;
      }
    }
    // Navigate to checkout
    navigate("/checkout");
  };

  const handleIncreaseQuantity = () => {
    if (cartItem) {
      updateQuantity(product.id, quantity + 1);
    } else {
      addItem(product);
    }
  };

  const handleDecreaseQuantity = () => {
    if (cartItem) {
      if (quantity > 1) {
        updateQuantity(product.id, quantity - 1);
      } else {
        removeItem(product.id);
        toast.success(`${product.title} removed from cart`);
      }
    }
  };

  const calculateDiscount = (mrp: number, price: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 lg:gap-8">
        {/* Left Side: Product Image Gallery + Sticky Buttons */}
        <div className="space-y-4 lg:w-[32rem]">
          {/* Main Product Image */}
          <div className="relative overflow-hidden rounded-lg shadow-elevated bg-muted max-w-xl mx-auto lg:mx-0">
            <img
              src={product.images[selectedImageIndex]}
              alt={product.title}
              loading="lazy"
              className="w-full aspect-square object-cover"
            />
            {product.isNew && (
              <Tag variant="new" size="lg" className="absolute top-4 right-4">
                {t("products.new")}
              </Tag>
            )}
          </div>

          {/* Image Thumbnails - Show up to 6 images */}
          {product.images.length > 1 && (
            <div className="grid grid-cols-6 gap-2 max-w-xl mx-auto lg:mx-0">
              {product.images.slice(0, 6).map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative overflow-hidden rounded-md border-2 transition-all ${selectedImageIndex === index
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <img
                    src={image}
                    alt={`${product.title} ${index + 1}`}
                    loading="lazy"
                    className="w-full aspect-square object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Sticky Action Buttons - Below Image - Full Width */}
          <div className="sticky top-4 z-10 space-y-3">
            {/* Quantity Controls */}
            {quantity > 0 && (
              <div className="max-w-xl mx-auto lg:mx-0">
                <div className="flex items-center gap-3 border-2 border-primary rounded-lg p-2">
                  <button
                    onClick={handleDecreaseQuantity}
                    className="p-2 hover:bg-primary/10 rounded transition-smooth"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-5 w-5 text-primary" />
                  </button>
                  <span className="flex-1 text-center font-bold text-lg">
                    {quantity}
                  </span>
                  <button
                    onClick={handleIncreaseQuantity}
                    className="p-2 hover:bg-primary/10 rounded transition-smooth"
                    disabled={
                      product.inventory !== undefined &&
                      quantity >= product.inventory
                    }
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-5 w-5 text-primary" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                variant="default"
                size="lg"
                className="flex-1"
                onClick={handleBuyNow}
                disabled={!product.inventory || product.inventory === 0}
              >
                {!product.inventory || product.inventory === 0 ? (
                  t("products.outOfStock")
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Buy Now
                  </>
                )}
              </Button>

              {quantity > 0 ? (
                <Link to="/cart" className="flex-1">
                  <Button variant="secondary" size="lg" className="w-full">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {t("cart.goToCart")}
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={!product.inventory || product.inventory === 0}
                >
                  {!product.inventory || product.inventory === 0 ? (
                    t("products.outOfStock")
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      {t("products.addToCart")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Product Info (Compact) */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-2 leading-tight">
              {product.title}
            </h1>

            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {product.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            )}

            {/* Only show rating when there are reviews */}
            {(product.reviewCount || 0) > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < Math.floor(product.rating || 0)
                        ? "fill-accent text-accent"
                        : "text-muted"
                        }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium">{product.rating}</span>
                <span className="text-xs text-muted-foreground">
                  ({product.ratingCount || 0} ratings &{" "}
                  {product.reviewCount || 0} reviews)
                </span>
              </div>
            )}
          </div>

          {/* Price Section with MRP and Discount */}
          <div className="border-t border-border pt-4">
            <div className="mb-3">
              <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                <p className="text-2xl font-bold text-primary">
                  ₹{product.price}
                </p>
                {product.mrp && product.mrp > product.price && (
                  <>
                    <p className="text-lg text-muted-foreground line-through">
                      ₹{product.mrp}
                    </p>
                    <Tag variant="discount" size="sm">
                      {product.discount ||
                        calculateDiscount(product.mrp, product.price)}
                      % OFF
                    </Tag>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Inclusive of all taxes
              </p>
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              {product.inventory && product.inventory > 0 ? (
                product.inventory < 15 ? (
                  <span className="text-sm font-semibold text-orange-600">
                    Low Stock - Only {product.inventory} left!
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-green-600">
                    In Stock
                  </span>
                )
              ) : (
                <span className="text-sm font-semibold text-red-600">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Return Policy */}
            <div className="flex items-center gap-2">
              {product.isReturnable ? (
                <>
                  <RotateCcw className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {product.returnDays} days return available
                  </span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Non-returnable
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Key Benefits Section */}
          {product.benefits && product.benefits.length > 0 && (
            <div className="border-t border-border pt-4">
              <h2 className="text-base font-semibold mb-3">Key Benefits</h2>
              <ul className="space-y-2">
                {product.benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-primary text-xs font-semibold">
                        ✓
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description Section - In Sidebar for short descriptions */}
          <div className="border-t border-border pt-4">
            <h2 className="text-base font-semibold mb-3">Description</h2>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
