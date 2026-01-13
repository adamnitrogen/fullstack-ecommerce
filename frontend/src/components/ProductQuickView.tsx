import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/Tag";
import { Separator } from "@/components/ui/separator";
import { Product } from "@/types";
import { Star, ShoppingCart, ExternalLink, Minus, Plus, Package, RotateCcw, X } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useState } from "react";

interface ProductQuickViewProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductQuickView({
  product,
  open,
  onOpenChange,
}: ProductQuickViewProps) {
  const { t } = useTranslation();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!product) return null;

  // Check if product is in cart
  const cartItem = items.find((item) => item.productId === product.id);
  const quantity = cartItem?.quantity || 0;


  const handleAddToCart = async () => {
    try {
      await addItem(product);
      toast.success(`${product.title} added to cart`, {
        icon: <ShoppingCart size={16} className="text-[#B85C3C]" />,
      });
    } catch (error) {
      // Error is handled in store (which shows toast)
    }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 bg-white border-none shadow-2xl rounded-3xl overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Left: Image Gallery */}
          <div className="relative bg-[#FAF7F2] p-4">
            <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg aspect-square">
              <img
                src={product.images[selectedImageIndex]}
                alt={product.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />

              {/* Tags */}
              <div className="absolute top-3 left-3 flex flex-col gap-2">
                {product.isNew && (
                  <Tag variant="new" size="sm" className="bg-[#B85C3C] text-white border-none px-3 py-1 shadow-md font-bold uppercase tracking-wider text-[9px]">
                    New
                  </Tag>
                )}
                {product.mrp && product.mrp > product.price && (
                  <Tag variant="discount" size="sm" className="bg-[#D4AF37] text-white border-none px-3 py-1 shadow-md font-black text-[9px]">
                    {calculateDiscount(product.mrp, product.price)}% OFF
                  </Tag>
                )}
              </div>
            </div>

            {/* Thumbnail Navigation */}
            {product.images.length > 1 && (
              <div className="flex gap-2 mt-3 justify-center">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative overflow-hidden rounded-lg border-2 transition-all duration-300 w-14 h-14 flex-shrink-0 ${selectedImageIndex === index
                      ? "border-[#B85C3C] shadow-md scale-105"
                      : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                  >
                    <img
                      src={image}
                      alt={`${product.title} ${index + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="p-5 space-y-4 overflow-y-auto max-h-[85vh]">
            <DialogHeader className="space-y-0 p-0">
              <DialogTitle className="text-xl font-bold text-[#2C1810] font-playfair leading-tight">
                {product.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Product details for {product.title}
              </DialogDescription>
            </DialogHeader>

            {/* Tags below title */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-[#FAF7F2] border border-[#B85C3C]/10 rounded-md text-[9px] font-bold text-[#B85C3C] uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Rating Summary */}
            {hasRating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#FAF7F2] px-2 py-0.5 rounded-full border border-[#B85C3C]/10">
                  <div className="flex items-center gap-0.5 mr-1.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={10}
                        className={i < Math.floor(product.rating || 0) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-muted"}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-[#2C1810]">{product.rating}</span>
                </div>
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                  {product.ratingCount} Ratings
                </span>
              </div>
            )}

            {/* Price & Tax */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-[#B85C3C]">₹{product.price}</span>
                {product.mrp && product.mrp > product.price && (
                  <span className="text-base text-muted-foreground line-through font-light opacity-50">₹{product.mrp}</span>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground font-medium tracking-wide">Inclusive of all taxes</p>
            </div>

            {/* Stock & Return */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Package size={14} className="text-muted-foreground" />
                <span className={`font-semibold ${stockStatus.color}`}>
                  {stockStatus.text}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {product.isReturnable ? (
                  <>
                    <RotateCcw size={14} className="text-green-600" />
                    <span className="font-medium text-green-600">
                      {product.returnDays} days return
                    </span>
                  </>
                ) : (
                  <>
                    <X size={14} className="text-muted-foreground" />
                    <span className="text-muted-foreground">Non-returnable</span>
                  </>
                )}
              </div>
            </div>

            <Separator className="bg-[#B85C3C]/10" />

            {/* Description */}
            {product.description && (
              <div className="space-y-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2C1810]">Description</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-light line-clamp-3">
                  {product.description}
                </p>
              </div>
            )}

            {/* Benefits */}
            {product.benefits && product.benefits.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2C1810]">Key Benefits</h3>
                <div className="grid grid-cols-1 gap-1">
                  {product.benefits.slice(0, 3).map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#B85C3C]" />
                      <span className="text-[10px] text-muted-foreground font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator className="bg-[#B85C3C]/10" />

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {quantity > 0 ? (
                <>
                  <div className="flex items-center justify-between bg-[#FAF7F2] p-2 rounded-xl border border-[#B85C3C]/10">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-2">Cart Quantity</span>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDecreaseQuantity}
                        className="h-7 w-7 rounded-full hover:bg-white transition-all shadow-sm"
                      >
                        <Minus size={12} />
                      </Button>
                      <span className="text-sm font-black text-[#2C1810] w-4 text-center">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleIncreaseQuantity}
                        disabled={product.inventory !== undefined && quantity >= product.inventory}
                        className="h-7 w-7 rounded-full hover:bg-white transition-all shadow-sm"
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                  </div>
                  <Link to="/cart" className="block">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full rounded-xl h-10 text-sm font-bold border-2 border-[#B85C3C]/20 text-[#B85C3C] hover:text-[#2C1810] hover:bg-[#FAF7F2] transition-colors"
                      onClick={() => onOpenChange(false)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {t("cart.goToCart")}
                    </Button>
                  </Link>
                </>
              ) : (
                <Button
                  onClick={handleAddToCart}
                  className="w-full rounded-xl h-10 text-sm font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/10"
                  size="lg"
                  disabled={!product.inventory || product.inventory === 0}
                >
                  {!product.inventory || product.inventory === 0 ? (
                    t("products.outOfStock")
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {t("products.addToCart")}
                    </>
                  )}
                </Button>
              )}

              <Link to={`/product/${product.id}`} className="block">
                <Button
                  variant="ghost"
                  className="w-full rounded-xl h-9 text-xs font-semibold text-[#B85C3C] hover:bg-[#FAF7F2] transition-colors"
                  size="lg"
                  onClick={() => onOpenChange(false)}
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  View Full Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
