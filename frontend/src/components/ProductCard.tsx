import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Star, Eye, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/Tag";
import { Product } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  showAddToCart?: boolean;
  className?: string;
}

export const ProductCard = ({
  product,
  onQuickView,
  showAddToCart = true,
  className = "",
}: ProductCardProps) => {
  const { t } = useTranslation();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const cartItem = items.find((item) => item.productId === product.id);
  const quantity = cartItem?.quantity || 0;

  const calculateDiscount = (mrp: number, price: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.title} added to cart`);
  };

  const handleIncreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity > 1) {
      updateQuantity(product.id, quantity - 1);
    } else {
      removeItem(product.id);
      toast.success(`${product.title} removed from cart`);
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    }
  };

  return (
    <Link to={`/product/${product.id}`}>
      <Card
        className={`group cursor-pointer hover:shadow-elevated transition-all duration-300 h-full flex flex-col ${className}`}
      >
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={product.images[0]}
            alt={product.title}
            loading="lazy"
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Quick View Button - appears on hover only on desktop when onQuickView is provided */}
          {onQuickView && (
            <button
              onClick={handleQuickView}
              className="hidden md:flex absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 items-center justify-center"
              aria-label="Quick view product"
            >
              <div className="bg-white text-foreground p-3 rounded-lg flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                <Eye className="h-5 w-5" />
              </div>
            </button>
          )}

          {product.isNew && (
            <Tag variant="new" className="absolute top-3 right-3 z-10">
              {t("products.new")}
            </Tag>
          )}
          {product.tags && product.tags.length > 0 && (
            <div className="absolute top-3 left-3 flex flex-wrap gap-1 max-w-[60%] z-10">
              {product.tags.slice(0, 2).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          )}
        </div>

        <CardContent className="p-4 flex-grow">
          <h3 className="font-semibold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-smooth">
            {product.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {product.description}
          </p>

          {/* Only show rating when there are reviews */}
          {(product.reviewCount || 0) > 0 && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-accent text-accent" />
                <span className="text-sm font-medium">{product.rating}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {product.ratingCount || 0} ratings & {product.reviewCount || 0}{" "}
                reviews
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl font-bold text-primary">₹{product.price}</p>
            {product.mrp && product.mrp > product.price && (
              <>
                <p className="text-sm text-muted-foreground line-through">
                  ₹{product.mrp}
                </p>
                <Tag variant="discount" size="sm">
                  {calculateDiscount(product.mrp, product.price)}% OFF
                </Tag>
              </>
            )}
          </div>
        </CardContent>

        {showAddToCart && (
          <CardFooter className="p-4 pt-0 mt-auto flex flex-col gap-2">
            {quantity > 0 ? (
              <>
                <div className="flex items-center gap-2 w-full">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDecreaseQuantity}
                    className="h-9 w-9"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="flex-1 text-center font-bold">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleIncreaseQuantity}
                    className="h-9 w-9"
                    disabled={
                      product.inventory !== undefined &&
                      quantity >= product.inventory
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Link to="/cart" className="w-full">
                  <Button variant="secondary" className="w-full text-xs h-8">
                    {t("cart.goToCart")}
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                variant="default"
                className="w-full"
                onClick={handleAddToCart}
                disabled={!product.inventory || product.inventory === 0}
              >
                {!product.inventory || product.inventory === 0
                  ? t("products.outOfStock")
                  : t("products.addToCart")}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </Link>
  );
};
