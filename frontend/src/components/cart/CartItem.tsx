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
    isCalculating?: boolean;
    isFreeDelivery?: boolean;
}

export const CartItem = ({ item, updateQuantity, removeItem, isLoading, isCalculating, isFreeDelivery }: CartItemProps) => {
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

    // Tax logic: Priority to variant, then product defaults
    const isTaxApplicable = variant?.tax_applicable ?? product.default_tax_applicable ?? false;
    const priceIncludesTax = variant?.price_includes_tax ?? product.default_price_includes_tax ?? false;

    return (
        <div className={cn(
            "group relative flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 bg-card/60 backdrop-blur-sm hover:bg-card/80 border border-border/50 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md animate-in fade-in slide-in-from-bottom-2",
            "sm:h-48"
        )}>
            {/* Recalculating Overlay */}
            {isCalculating && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-[1px] rounded-2xl transition-all animate-in fade-in duration-300">
                    <span className="flex items-center gap-2 px-4 py-1.5 bg-background/90 rounded-full border shadow-sm text-[10px] font-black uppercase tracking-[0.2em] text-primary animate-pulse">
                        Recalculating...
                    </span>
                </div>
            )}
            {/* Product Image */}
            <Link to={`/product/${item.productId}`} className="shrink-0 relative overflow-hidden rounded-xl aspect-square w-full sm:w-40 h-auto sm:h-full bg-muted shadow-inner border border-border/30">
                <img
                    src={displayImage}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                />
                {isDiscounted && (
                    <div className="absolute top-2 left-2">
                        <Tag variant="discount" size="sm" className="shadow-lg backdrop-blur-md bg-destructive/90 text-white border-0 text-[10px] px-1.5 py-0.5">
                            -{discountPercentage}%
                        </Tag>
                    </div>
                )}
            </Link>

            {/* Content */}
            <div className="flex flex-1 flex-col justify-between min-w-0 py-1 sm:py-2">
                <div>
                    <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[9px] uppercase tracking-wider font-bold text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded-full border border-primary/10">
                                    {product.category}
                                </span>
                                {(sizeLabel || variant?.size_label) && (
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                        {sizeLabel || variant?.size_label}
                                    </span>
                                )}
                            </div>
                            <Link
                                to={`/product/${item.productId}`}
                                className="font-bold text-base sm:text-lg hover:text-primary transition-colors line-clamp-1 leading-tight tracking-tight"
                            >
                                {product.title}
                            </Link>

                            <div className="flex items-center gap-3 mt-1">
                                {isOutOfStock ? (
                                    <span className="text-destructive font-bold text-[10px] uppercase flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-destructive animate-pulse" />
                                        Out of Stock
                                    </span>
                                ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                        In Stock
                                    </span>
                                )}
                                {Number(product.rating) > 0 && (
                                    <div className="flex items-center gap-1 text-amber-500 font-bold text-[10px]">
                                        <Star className="w-3 h-3 fill-current" />
                                        <span>{product.rating}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-0.5 -mt-1">
                            <button
                                onClick={() => removeItem(item.productId, variantId)}
                                disabled={isLoading}
                                className="text-muted-foreground hover:text-destructive transition-colors p-1.5 hover:bg-destructive/10 rounded-full"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Compact Badges */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        {(item.delivery_charge ?? 0) > 0 ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 rounded-md text-[9px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                                <Truck className="w-2.5 h-2.5" />
                                <span>Delivery Fee: ₹{item.delivery_charge}</span>
                            </div>
                        ) : isFreeDelivery && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-950/20 rounded-md text-[9px] font-bold text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30">
                                <Truck className="w-2.5 h-2.5" />
                                <span>Free Delivery</span>
                            </div>
                        )}

                        {(item.coupon_discount ?? 0) > 0 && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 rounded-md text-[9px] font-black text-primary border border-primary/20">
                                <Tag className="w-2.5 h-2.5" />
                                <span>Coupon Applied: -₹{item.coupon_discount}</span>
                            </div>
                        )}

                        {((product as any).is_returnable !== undefined ? (product as any).is_returnable : product.isReturnable) ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-950/20 rounded-md text-[9px] font-bold text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30">
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>{(product as any).return_days ?? product.returnDays ?? 7}d Return</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded-md text-[9px] font-bold text-muted-foreground border border-border/50">
                                <Package className="w-2.5 h-2.5" />
                                <span>No Returns</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Price and Quantity Footer */}
                <div className="flex items-end justify-between gap-4 mt-auto">
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-primary tracking-tight">₹{itemPrice}</span>
                            {isDiscounted && (
                                <span className="text-[11px] text-muted-foreground line-through font-medium">
                                    ₹{itemMRP}
                                </span>
                            )}
                        </div>
                        {isTaxApplicable && (
                            <span className="text-[9px] text-muted-foreground/80 font-medium leading-none">
                                {priceIncludesTax ? "Inclusive of taxes" : "Excl. taxes"}
                            </span>
                        )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border border-border/40">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-7 w-7 rounded-md transition-colors",
                                quantity === 1 ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-background shadow-sm"
                            )}
                            onClick={() => {
                                if (quantity > 1) updateQuantity(item.productId, quantity - 1, variantId);
                                else removeItem(item.productId, variantId);
                            }}
                            disabled={isLoading}
                        >
                            {quantity === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        </Button>
                        <div className="w-6 text-center font-black text-sm tabular-nums">
                            {quantity}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md bg-background shadow-sm hover:bg-muted transition-colors border border-border/20"
                            onClick={() => updateQuantity(item.productId, quantity + 1, variantId)}
                            disabled={isLoading || quantity >= itemStock}
                        >
                            <Plus className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
