import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/Tag";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Product } from "@/types";
import { Star, ShoppingCart, ExternalLink, Minus, Plus } from "lucide-react";
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

  const handleAddToCart = () => {
    addItem(product);
    toast.success(`${product.title} added to cart`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <ScrollArea className="h-[90vh]">
          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* Left: Images */}
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-lg bg-muted">
                <img
                  src={product.images[selectedImageIndex]}
                  alt={product.title}
                  loading="lazy"
                  className="w-full aspect-square object-cover"
                />
                {product.isNew && (
                  <Tag variant="new" className="absolute top-3 right-3">
                    NEW
                  </Tag>
                )}
              </div>

              {/* Thumbnail Navigation */}
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative overflow-hidden rounded-md border-2 transition-all ${selectedImageIndex === index
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/20"
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
            </div>

            {/* Right: Details */}
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">
                  {product.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Product details for {product.title}
                </DialogDescription>
                <div className="space-y-4">
                  {/* Rating */}
                  <div>
                    {(product.reviewCount || 0) > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < Math.floor(product.rating || 0)
                                ? "fill-accent text-accent"
                                : "text-muted-foreground/30"
                                }`}
                            />
                          ))}
                          <span className="font-medium">{product.rating}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          ({product.ratingCount || 0} ratings &{" "}
                          {product.reviewCount || 0} reviews)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    <div className="flex items-baseline gap-3 mb-1">
                      <p className="text-3xl font-bold text-primary">
                        ₹{product.price}
                      </p>
                      {product.mrp && product.mrp > product.price && (
                        <>
                          <p className="text-xl text-muted-foreground line-through">
                            ₹{product.mrp}
                          </p>
                          <Tag variant="discount" size="sm">
                            {product.discount ||
                              Math.round(
                                ((product.mrp - product.price) / product.mrp) *
                                100
                              )}
                            % OFF
                          </Tag>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Inclusive of all taxes
                    </p>
                  </div>

                  {/* Tags */}
                  {product.tags && product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              </DialogHeader>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="font-semibold">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Benefits */}
              {product.benefits && product.benefits.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Benefits</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {product.benefits.map((benefit, index) => (
                      <li key={index}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Category and Availability */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Category</p>
                  <p className="font-medium">{product.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Availability
                  </p>
                  <p className="font-medium">
                    {product.inventory && product.inventory > 0 ? (
                      <span className="text-green-600">In Stock</span>
                    ) : (
                      <span className="text-red-600">Out of Stock</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Quantity Controls or Add to Cart */}
                {quantity > 0 ? (
                  <div className="space-y-3">
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
                    <Link to="/cart" className="block">
                      <Button variant="secondary" className="w-full" size="lg" onClick={() => onOpenChange(false)}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {t("cart.goToCart")}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    onClick={handleAddToCart}
                    className="w-full"
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
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={() => onOpenChange(false)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Full Details
                  </Button>
                </Link>
              </div>

              {/* Additional Info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>✓ 100% Organic</p>
                <p>✓ Free Delivery on orders above ₹1000</p>
                <p>✓ 7 Day Return Policy</p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
