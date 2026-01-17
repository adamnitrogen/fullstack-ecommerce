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

            <ScrollArea className="max-h-[320px] pr-4 -mr-4">
                <div className="space-y-3 pt-2">
                    {items.map((item) => (
                        <div key={item.id} className="flex gap-3 items-start group">
                            <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border border-border/50 bg-muted/20 relative">
                                <AspectRatio ratio={1}>
                                    <img
                                        src={item.product.images[0] || "/placeholder.png"}
                                        alt={item.product.title}
                                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                                    />
                                </AspectRatio>
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                                <h4 className="text-sm font-semibold line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                                    {item.product.title}
                                </h4>
                                {item.sizeLabel && (
                                    <p className="text-xs text-muted-foreground">
                                        {item.sizeLabel}
                                    </p>
                                )}
                                <div className="flex justify-between items-center text-xs">
                                    <p className="text-muted-foreground font-medium">
                                        Qty: <span className="text-foreground">{item.quantity}</span>
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
                                    </div>
                                </div>
                            </div>
                            {(item.delivery_charge ?? 0) > 0 && (
                                <div className="text-[10px] text-orange-600 font-medium flex flex-col gap-0.5 mt-1 bg-orange-50/50 p-1.5 rounded border border-orange-100/50">
                                    <span className="font-bold flex items-center gap-1">
                                        <Truck className="w-3 h-3" />
                                        ₹{(item.delivery_charge ?? 0).toFixed(2)} Delivery
                                        {(item.delivery_gst ?? 0) > 0 && ` + ₹${(item.delivery_gst ?? 0).toFixed(2)} GST`}
                                    </span>
                                    {item.delivery_meta && (
                                        <span className="text-[9px] text-orange-600/80 pl-4">
                                            {item.delivery_meta.calculation_type === 'PER_ITEM' && `(₹${item.delivery_meta.base_charge} / item)`}
                                            {item.delivery_meta.calculation_type === 'FLAT_PER_ORDER' && `(Flat ₹${item.delivery_meta.base_charge} / order)`}
                                            {item.delivery_meta.calculation_type === 'PER_PACKAGE' && `(₹${item.delivery_meta.base_charge} / package of ${item.delivery_meta.max_items_per_package})`}
                                            {item.delivery_meta.calculation_type === 'WEIGHT_BASED' && `(Weight Based)`}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

