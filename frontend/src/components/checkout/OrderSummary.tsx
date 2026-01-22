import { CartItem } from "@/types";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Receipt, ShoppingBag, Truck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface OrderSummaryProps {
    items: (CartItem & { id: string })[];
}

export function OrderSummary({ items }: OrderSummaryProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2">
                <div className="bg-primary/10 p-2 rounded-full">
                    <Receipt className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-lg font-playfair">Order Summary</h3>
                <span className="ml-auto text-xs font-medium bg-muted px-2 py-1 rounded-full text-muted-foreground">
                    {items.length} Items
                </span>
            </div>

            <Separator className="bg-border/60" />

            <ScrollArea className="max-h-[60vh] pr-4 -mr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
                    {items.map((item) => (
                        <div key={item.id} className="flex gap-3 items-start group bg-muted/20 p-3 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                            <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border border-border/50 bg-white relative">
                                <AspectRatio ratio={1}>
                                    <img
                                        src={item.product.images[0] || "/placeholder.png"}
                                        alt={item.product.title}
                                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                                    />
                                </AspectRatio>
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <h4 className="text-sm font-semibold line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-tight">
                                    {item.product.title}
                                </h4>
                                {item.sizeLabel && (
                                    <p className="text-xs text-muted-foreground">
                                        {item.sizeLabel}
                                    </p>
                                )}
                                <div className="flex justify-between items-center text-xs mt-1">
                                    <p className="text-muted-foreground font-medium">
                                        Qty: <span className="text-foreground font-bold">{item.quantity}</span>
                                    </p>
                                    <div className="text-right">
                                        <p className="font-bold tabular-nums">
                                            ₹{((item.variant?.selling_price ?? item.product.price) * item.quantity).toFixed(2)}
                                        </p>
                                        {((item.variant?.mrp ?? item.product.mrp ?? 0) > (item.variant?.selling_price ?? item.product.price)) && (
                                            <p className="text-[10px] text-muted-foreground line-through tabular-nums opacity-70">
                                                ₹{((item.variant?.mrp ?? item.product.mrp ?? 0) * item.quantity).toFixed(2)}
                                            </p>
                                        )}

                                        {(item.delivery_charge ?? 0) > 0 && (
                                            <div className="text-[10px] text-orange-600 font-bold flex items-center gap-1 mt-1 justify-end">
                                                <Truck className="w-3 h-3" />
                                                +₹{((item.delivery_charge ?? 0) + (item.delivery_gst ?? 0)).toFixed(2)} Delivery
                                            </div>
                                        )}

                                        {/* Tax Info */}
                                        {(() => {
                                            const rate = item.variant?.gst_rate ?? item.product?.default_gst_rate ?? 0;
                                            if (rate <= 0) return null;
                                            const price = (item.variant?.selling_price ?? item.product.price) * item.quantity;
                                            const tax = price - (price / (1 + rate / 100));
                                            return (
                                                <p className="text-[9px] text-muted-foreground/40 italic tabular-nums mt-0.5">
                                                    incl. ₹{tax.toFixed(2)} Tax
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
