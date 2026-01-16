import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShoppingCart, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

interface StockIssue {
    productId: string;
    variantId: string | null;
    title: string;
    variantLabel: string | null;
    requestedQty: number;
    availableStock: number;
    image: string | null;
}

interface OutOfStockModalProps {
    open: boolean;
    onClose: () => void;
    items: StockIssue[];
    onRemoveItem?: (productId: string, variantId: string | null) => void;
}

export function OutOfStockModal({
    open,
    onClose,
    items,
    onRemoveItem,
}: OutOfStockModalProps) {
    if (items.length === 0) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Stock Unavailable
                    </DialogTitle>
                    <DialogDescription>
                        Some items in your cart are no longer available in the requested quantity.
                        Please update your cart to proceed.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 max-h-[300px] overflow-y-auto py-2">
                    {items.map((item) => (
                        <div
                            key={`${item.productId}-${item.variantId || 'default'}`}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-destructive/20"
                        >
                            {item.image && (
                                <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-12 h-12 object-cover rounded"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.title}</p>
                                {item.variantLabel && (
                                    <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                                )}
                                <p className="text-xs text-destructive mt-1">
                                    {item.availableStock === 0 ? (
                                        "Out of stock"
                                    ) : (
                                        <>
                                            Only <strong>{item.availableStock}</strong> available
                                            (you requested {item.requestedQty})
                                        </>
                                    )}
                                </p>
                            </div>
                            {onRemoveItem && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => onRemoveItem(item.productId, item.variantId)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                    <Button asChild className="w-full">
                        <Link to="/cart">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Update Cart
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={onClose} className="w-full">
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
