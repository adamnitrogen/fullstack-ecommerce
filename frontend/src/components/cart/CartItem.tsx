import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, RotateCcw, Package, Star, Heart, Truck, Tag } from "lucide-react";
import { CartItem as CartItemType } from "@/types";
import { Button } from "@/components/ui/button";
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
            "group relative flex flex-col sm:flex-row gap-4 p-4 bg-card/40 backdrop-blur-md hover:bg-card/60 border border-border/40 rounded-3xl transition-all duration-500 shadow-sm hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4",
            "sm:min-h-[180px]"
        )}>
            {/* Recalculating Overlay */}
            {isCalculating && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-md rounded-3xl transition-all animate-in fade-in duration-500">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">
                            Syncing
                        </span>
                    </div>
                </div>
            )}

            {/* Product Image Section */}
            <div className="relative shrink-0 w-full sm:w-44 aspect-square">
                <Link to={`/product/${item.productId}`} className="block h-full w-full overflow-hidden rounded-2xl shadow-inner border border-border/20 group/img">
                    <img
                        src={displayImage}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover/img:scale-110"
                        loading="lazy"
                    />
                </Link>

                {isDiscounted && (
                    <div className="absolute top-2.5 left-2.5 z-10">
                        <div className="bg-destructive/90 text-white text-[10px] font-black px-2 py-1 rounded-lg backdrop-blur-md shadow-lg border border-white/20">
                            -{discountPercentage}%
                        </div>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="flex flex-1 flex-col min-w-0">
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] uppercase tracking-widest font-black text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/10">
                                {product.category}
                            </span>
                            {(sizeLabel || variant?.size_label) && (
                                <span className="text-[10px] uppercase tracking-widest font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                                    {sizeLabel || variant?.size_label}
                                </span>
                            )}
                            {isOutOfStock ? (
                                <span className="text-[9px] font-black uppercase text-destructive flex items-center gap-1.5 ml-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                    Out of Stock
                                </span>
                            ) : (
                                <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-1.5 ml-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    In Stock
                                </span>
                            )}
                        </div>

                        <Link
                            to={`/product/${item.productId}`}
                            className="block font-bold text-lg sm:text-xl hover:text-primary transition-all duration-300 line-clamp-1 leading-tight tracking-tight mt-1"
                        >
                            {product.title}
                        </Link>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                            {((product as any).is_returnable !== undefined ? (product as any).is_returnable : product.isReturnable) ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground/80">
                                    <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-[10px] font-medium">{(product as any).return_days ?? product.returnDays ?? 7}d Return</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-muted-foreground/60">
                                    <Package className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-medium">No Returns</span>
                                </div>
                            )}

                            {(item.delivery_charge ?? 0) > 0 ? (
                                <div className="flex flex-col items-start gap-0.5 w-full">
                                    <div className="flex items-center gap-1.5 font-bold">
                                        <Truck className="w-3.5 h-3.5" />
                                        <span>
                                            ₹{(item.delivery_charge ?? 0).toFixed(2)} Delivery
                                            {(item.delivery_gst ?? 0) > 0 && ` + ₹${(item.delivery_gst ?? 0).toFixed(2)} GST`}
                                        </span>
                                    </div>
                                    {item.delivery_meta && (
                                        <span className="text-[9px] text-orange-600/90 font-medium pl-5 tracking-wide">
                                            {item.delivery_meta.calculation_type === 'PER_ITEM' && `(₹${item.delivery_meta.base_charge} / item)`}
                                            {item.delivery_meta.calculation_type === 'FLAT_PER_ORDER' && `(Flat ₹${item.delivery_meta.base_charge} / order)`}
                                            {item.delivery_meta.calculation_type === 'PER_PACKAGE' && `(₹${item.delivery_meta.base_charge} / package of ${item.delivery_meta.max_items_per_package})`}
                                            {item.delivery_meta.calculation_type === 'WEIGHT_BASED' && `(Weight Based)`}
                                        </span>
                                    )}
                                </div>
                            ) : isFreeDelivery && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg text-[10px] font-bold text-emerald-700 border border-emerald-100">
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Free Delivery</span>
                                </div>
                            )}

                            {(item.coupon_discount ?? 0) > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 rounded-lg text-[10px] font-black text-primary border border-primary/20">
                                    <Tag className="w-3.5 h-3.5" />
                                    <span>-₹{(item.coupon_discount || 0).toFixed(2)} Saved</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => removeItem(item.productId, variantId)}
                        disabled={isLoading}
                        className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl p-2.5 transition-all duration-300"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Price and Quantity Footer */}
                <div className="flex items-center justify-between gap-4 mt-auto pt-4 border-t border-border/10">
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-2.5">
                            <span className="text-2xl font-black text-foreground tracking-tighter">
                                ₹{itemPrice.toFixed(2)}
                            </span>
                            {isDiscounted && (
                                <span className="text-sm text-muted-foreground/60 line-through font-medium">
                                    ₹{itemMRP.toFixed(2)}
                                </span>
                            )}
                        </div>
                        {isTaxApplicable && (
                            <span className="text-[10px] text-muted-foreground/60 font-medium">
                                {priceIncludesTax ? "Inclusive of all taxes" : "Exclusive of taxes"}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-muted/30 p-1.5 rounded-xl border border-border/20 shadow-inner">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-8 w-8 rounded-lg transition-all duration-300",
                            quantity === 1 ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-background hover:shadow-md"
                        )}
                        onClick={() => {
                            if (quantity > 1) updateQuantity(item.productId, quantity - 1, variantId);
                            else removeItem(item.productId, variantId);
                        }}
                        disabled={isLoading}
                    >
                        {quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    </Button>
                    <div className="w-8 text-center font-black text-base tabular-nums text-foreground/80">
                        {quantity}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-background hover:shadow-md transition-all duration-300"
                        onClick={() => updateQuantity(item.productId, quantity + 1, variantId)}
                        disabled={isLoading || quantity >= itemStock}
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
