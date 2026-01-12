import { CartItem } from "@/types";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";

interface OrderSummaryProps {
    items: (CartItem & { id: string })[];
}

export function OrderSummary({ items }: OrderSummaryProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Order Items ({items.length})</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-start">
                        <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border border-border">
                            <AspectRatio ratio={1}>
                                <img
                                    src={item.product.images[0] || "/placeholder.png"}
                                    alt={item.product.title}
                                    className="object-cover w-full h-full"
                                />
                            </AspectRatio>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium line-clamp-2">
                                {item.product.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                Qty: {item.quantity} × ₹{item.product.price}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="font-medium text-sm">
                                ₹{(item.product.price * item.quantity).toFixed(2)}
                            </p>
                            {(item.product.mrp || 0) > item.product.price && (
                                <p className="text-xs text-muted-foreground line-through">
                                    ₹{((item.product.mrp || 0) * item.quantity).toFixed(2)}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
