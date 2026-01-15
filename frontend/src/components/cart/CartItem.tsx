import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, RotateCcw, Package, Star, Heart, Truck } from "lucide-react";
import { CartItem as CartItemType } from "@/types";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";

interface CartItemProps {
    item: CartItemType;
    updateQuantity: (productId: string, quantity: number, variantId?: string) => Promise<void>;
    removeItem: (productId: string, variantId?: string) => Promise<void>;
    isLoading?: boolean;
    isFreeDelivery?: boolean;
}

export const CartItem = ({ item, updateQuantity, removeItem, isLoading, isFreeDelivery }: CartItemProps) => {
    const { product, quantity, variant, sizeLabel, variantId } = item;

    // Use variant pricing if available, otherwise fall back to product pricing
    const itemPrice = variant?.selling_price ?? product.price;
    const itemMRP = variant?.mrp ?? product.mrp ?? product.price;
    const itemStock = variant?.stock_quantity ?? product.inventory ?? 0;
    const displayImage = variant?.variant_image_url || product.images[0];

    const isDiscounted = itemMRP > itemPrice;
    const discountPercentage = isDiscounted
        ? Math.round(((itemMRP - itemPrice) / itemMRP) * 100)
        : 0;

    const isLowStock = itemStock > 0 && itemStock <= 5;
    const isOutOfStock = itemStock === 0;

    return (
        <div className="group relative flex flex-col sm:flex-row gap-4 sm:gap-6 p-5 sm:p-6 bg-card/60 backdrop-blur-sm hover:bg-card/80 border border-border/50 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2">
            {/* Product Image */}
            <Link to={`/product/${item.productId}`} className="shrink-0 relative overflow-hidden rounded-xl aspect-square w-28 sm:w-36 bg-muted shadow-inner border border-border/30">
                <img
                    src={displayImage}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                />
                {isDiscounted && (
                    <div className="absolute top-2 left-2">
                        <Tag variant="discount" size="sm" className="shadow-lg backdrop-blur-md bg-destructive/90 text-white border-0">
                            -{discountPercentage}%
                        </Tag>
                    </div>
                )}
            </Link>

            {/* Content */}
            <div className="flex flex-1 flex-col justify-between min-w-0 gap-4">
                <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-primary/70 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                                {product.category}
                            </span>
                            {(sizeLabel || variant?.size_label) && (
                                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                    {sizeLabel || variant?.size_label}
                                </span>
                            )}
                        </div>
                        <Link
                            to={`/product/${item.productId}`}
                            className="font-bold text-lg sm:text-xl hover:text-primary transition-colors line-clamp-1 leading-tight tracking-tight"
                        >
                            {product.title}
                        </Link>

                        {/* Quick Summary */}
                        <p className="text-xs text-muted-foreground line-clamp-1 italic mb-2">
                            {product.description || "No description available"}
                        </p>

                        {/* Rating and Stock */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <div className="flex items-center gap-1 text-amber-500 font-medium">
                                <Star className={cn("w-4 h-4", (product.rating && product.rating > 0) ? "fill-current" : "text-muted-foreground")} />
                                <span>{product.rating || "0.0"}</span>
                                <span className="text-muted-foreground text-[10px]">({product.ratingCount || 0} reviews)</span>
                            </div>

                            {isOutOfStock ? (
                                <div className="text-destructive font-medium text-xs flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                    Out of Stock
                                </div>
                            ) : isLowStock ? (
                                <div className="text-amber-600 dark:text-amber-400 font-medium text-xs flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Only {product.inventory} left!
                                </div>
                            ) : (
                                <div className="text-emerald-600 dark:text-emerald-400 font-medium text-xs flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    In Stock
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            className="text-muted-foreground hover:text-pink-500 transition-colors p-2 hover:bg-pink-50 dark:hover:bg-pink-950/20 rounded-full shrink-0"
                            aria-label="Move to wishlist"
                        >
                            <Heart className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => removeItem(item.productId)}
                            disabled={isLoading}
                            className="text-muted-foreground hover:text-destructive transition-colors p-2 hover:bg-destructive/10 rounded-full shrink-0"
                            aria-label="Remove item"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-6 pt-2">
                    <div className="space-y-3">
                        {/* Features/Badges */}
                        <div className="flex flex-wrap gap-2">
                            {isFreeDelivery ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/20 rounded-full text-[11px] font-medium text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30">
                                    <Truck className="w-3 h-3" />
                                    <span>Free Delivery</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full text-[11px] font-medium text-muted-foreground border border-border/50">
                                    <Truck className="w-3 h-3" />
                                    <span>Delivery Charge Applicable</span>
                                </div>
                            )}
                            {product.isReturnable ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-950/20 rounded-full text-[11px] font-medium text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30">
                                    <RotateCcw className="w-3 h-3" />
                                    <span>{product.returnDays} Days Return</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full text-[11px] font-medium text-muted-foreground border border-border/50">
                                    <Package className="w-3 h-3" />
                                    <span>Non-Returnable</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-baseline gap-2.5">
                            <span className="text-2xl font-black text-primary tracking-tight">₹{itemPrice}</span>
                            {isDiscounted && (
                                <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/60 font-medium">
                                    ₹{itemMRP}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 bg-muted/30 p-1.5 rounded-xl border border-border/50">
                        <div className="flex items-center bg-background rounded-lg border border-border/50 shadow-sm overflow-hidden">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-9 w-9 rounded-none transition-colors",
                                    quantity === 1 ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted"
                                )}
                                onClick={() => {
                                    if (quantity > 1) updateQuantity(item.productId, quantity - 1, variantId);
                                    else removeItem(item.productId, variantId);
                                }}
                                disabled={isLoading}
                            >
                                {quantity === 1 ? (
                                    <Trash2 className="w-4 h-4" />
                                ) : (
                                    <Minus className="w-4 h-4" />
                                )}
                            </Button>
                            <div className="w-12 text-center font-bold text-base tabular-nums">
                                {quantity}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-none hover:bg-muted transition-colors"
                                onClick={() => updateQuantity(item.productId, quantity + 1, variantId)}
                                disabled={isLoading || quantity >= itemStock}
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
