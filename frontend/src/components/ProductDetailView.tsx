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
import { Tag } from "@/components/ui/Tag";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

  const handleAddToCart = async () => {
    try {
      await addItem(product);
      toast.success(`${product.title} added to cart`, {
        icon: <ShoppingCart size={16} className="text-primary" />,
      });
    } catch (error) {
      // Error is handled in store (which shows toast)
    }
  };

  const handleBuyNow = async () => {
    if (!user?.email || user.email.trim() === "") {
      toast.error("Email Required", {
        description: "Please add your email address in profile settings before making a purchase.",
      });
      return;
    }
    if (!cartItem) {
      try {
        await addItem(product);
      } catch (error) {
        // Error toast shown by store
        return;
      }
    }
    navigate("/checkout");
  };

  const handleIncreaseQuantity = async () => {
    try {
      if (cartItem) {
        await updateQuantity(product.id, quantity + 1);
      } else {
        await addItem(product);
      }
    } catch (error) {
      // Handled by store
    }
  };

  const handleDecreaseQuantity = async () => {
    if (cartItem) {
      try {
        if (quantity > 1) {
          await updateQuantity(product.id, quantity - 1);
        } else {
          await removeItem(product.id);
          toast.success(`${product.title} removed from cart`);
        }
      } catch (error) {
        // Handled by store
      }
    }
  };

  const calculateDiscount = (mrp: number, price: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const getStockStatus = () => {
    const inventory = product.inventory || 0;
    if (inventory === 0) return { text: t("products.outOfStock"), color: "text-red-600" };
    if (inventory < 5) return { text: "Only few left", color: "text-orange-600" };
    if (inventory < 20) return { text: "Low stock", color: "text-orange-500" };
    return { text: "In Stock", color: "text-green-600" };
  };

  const stockStatus = getStockStatus();
  const hasRating = (product.ratingCount || 0) > 0;

  return (
    <div className={`${className} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Side: Product Image Gallery */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Product Image */}
          <Card className="relative overflow-hidden rounded-[2rem] border-none shadow-xl bg-white aspect-square max-w-xl mx-auto lg:mx-0">
            <img
              src={product.images[selectedImageIndex]}
              alt={product.title}
              className="w-full h-full object-cover"
            />

            {product.isNew && (
              <div className="absolute top-6 left-6">
                <Tag variant="new" size="sm" className="bg-[#B85C3C] text-white border-none px-4 py-1.5 shadow-lg font-bold uppercase tracking-wider text-[9px]">
                  New
                </Tag>
              </div>
            )}

            {product.mrp && product.mrp > product.price && (
              <div className="absolute top-6 right-6">
                <Tag variant="discount" size="sm" className="bg-[#D4AF37] text-white border-none px-4 py-1.5 shadow-lg font-black text-[9px]">
                  {calculateDiscount(product.mrp, product.price)}% OFF
                </Tag>
              </div>
            )}
          </Card>

          {/* Image Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-3 px-1 overflow-x-auto pb-2 no-scrollbar justify-center lg:justify-start">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden transition-all duration-300 border-2 ${selectedImageIndex === index
                    ? "border-[#B85C3C] shadow-md scale-105"
                    : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                >
                  <img src={image} alt={product.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Product Info */}
        <div className="lg:col-span-7 space-y-4 lg:space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl lg:text-4xl font-bold text-[#2C1810] font-playfair leading-tight">
              {product.title}
            </h1>

            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {product.tags.map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-[#FAF7F2] border border-[#B85C3C]/10 rounded-md text-[10px] font-bold text-[#B85C3C] uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Rating Summary - Conditionally shown */}
            {hasRating && (
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#B85C3C]/10">
                  <div className="flex items-center gap-0.5 mr-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < Math.floor(product.rating || 0) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-muted"}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-[#2C1810]">{product.rating}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {product.ratingCount} Ratings
                </span>
              </div>
            )}
          </div>

          {/* Price & Taxes */}
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-black text-[#B85C3C]">₹{product.price}</span>
              {product.mrp && product.mrp > product.price && (
                <span className="text-lg text-muted-foreground line-through font-light opacity-50">₹{product.mrp}</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide">Inclusive of all taxes</p>
          </div>

          {/* Stock status without number */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-muted-foreground" />
              <span className={`text-sm font-bold ${stockStatus.color}`}>
                {stockStatus.text}
              </span>
            </div>

            {/* Return Policy - Immediately below stock */}
            <div className="flex items-center gap-2">
              {product.isReturnable ? (
                <>
                  <RotateCcw className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-600">
                    {product.returnDays} days return available
                  </span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Non-returnable
                  </span>
                </>
              )}
            </div>
          </div>

          <Separator className="bg-[#B85C3C]/10" />

          {/* Description & Benefits */}
          <div className="space-y-3">
            {product.description && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">
                  {product.description}
                </p>
              </div>
            )}

            {product.benefits && product.benefits.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">Key Benefits</h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {product.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#B85C3C]" />
                      <span className="text-xs text-muted-foreground font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <Separator className="bg-[#B85C3C]/10" />

          {/* Action Column - Moved below details */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5">
                <Button
                  size="lg"
                  onClick={handleBuyNow}
                  disabled={!product.inventory || product.inventory === 0}
                  className="w-full rounded-xl h-12 text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/10"
                >
                  <Zap className="h-5 w-5 mr-3 fill-current" />
                  Buy Now
                </Button>

                {quantity > 0 ? (
                  <div className="space-y-2.5">
                    {/* Quantity Selector - Integrated with Buy Now context */}
                    {product.inventory && product.inventory > 0 && (
                      <div className="flex items-center justify-between bg-[#FAF7F2] p-2 rounded-xl border border-[#B85C3C]/10 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-2">Cart Quantity</span>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDecreaseQuantity}
                            className="h-8 w-8 rounded-full hover:bg-white transition-all shadow-sm"
                          >
                            <Minus size={14} />
                          </Button>
                          <span className="text-base font-black text-[#2C1810] w-4 text-center">{quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleIncreaseQuantity}
                            disabled={product.inventory !== undefined && quantity >= product.inventory}
                            className="h-8 w-8 rounded-full hover:bg-white transition-all shadow-sm"
                          >
                            <Plus size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                    <Link to="/cart" className="block">
                      <Button variant="outline" size="lg" className="w-full rounded-xl h-12 text-base font-bold border-2 border-[#B85C3C]/20 text-[#B85C3C] hover:text-[#2C1810] hover:bg-[#FAF7F2] transition-colors">
                        <ShoppingCart className="h-5 w-5 mr-3" />
                        Complete Your Order
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleAddToCart}
                    disabled={!product.inventory || product.inventory === 0}
                    className="w-full rounded-xl h-12 text-base font-bold border-2 border-[#B85C3C]/20 text-[#B85C3C] hover:text-[#2C1810] hover:bg-[#FAF7F2] transition-colors"
                  >
                    <ShoppingCart className="h-5 w-5 mr-3" />
                    Add to Cart
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
