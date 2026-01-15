import { logger } from "@/lib/logger";
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Package, CreditCard, Clock, CheckCircle, AlertTriangle, XCircle, RotateCcw, FileText, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Order, CartItem, Product, Address } from "@/types";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

interface OrderResponse {
    id: string;
    order_number?: string;
    created_at: string;
    createdAt?: string;
    status: string;
    invoice_url?: string;
    subtotal?: number;
    total_amount: number;
    delivery_charge?: number;
    shipping_address?: Address & { full_name?: string; address_line1?: string; address_line2?: string; postal_code?: string; }; // handling specific fields used
    billing_address?: Address & { full_name?: string; address_line1?: string; address_line2?: string; postal_code?: string; };
    payment_status?: string;
    paymentStatus?: string;
    payment_method?: string;
    payment_id?: string;
    items: Array<{
        id: string;
        quantity: number;
        price_per_unit?: number;
        remaining_quantity?: number;
        product?: Product;
        title?: string; // fallback if product is flattened
        price?: number;
        // Variant fields
        variant_id?: string;
        variant?: {
            id: string;
            size_label: string;
            size_value: number;
            unit: string;
            variant_image_url?: string;
        };
        size_label?: string; // Direct size label if variant is flattened
    }>;
    order_status_history?: Array<{
        status: string;
        created_at: string;
        notes?: string;
        updater?: { role_data?: { name: string } };
    }>;
}

interface ReturnableItem {
    id: string;
    title: string;
    price_per_unit: number;
    remaining_quantity: number;
}

export default function UserOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");

    // Action States
    const [cancelReason, setCancelReason] = useState("");
    const [returnReason, setReturnReason] = useState("");
    const [cancelOpen, setCancelOpen] = useState(false);
    const [returnOpen, setReturnOpen] = useState(false);
    const [selectedReturnItems, setSelectedReturnItems] = useState<{ id: string; quantity: number }[]>([]);
    const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);

    const handleReturnItemChange = (orderItemId: string, quantity: number, maxQuantity: number) => {
        if (quantity < 0 || quantity > maxQuantity) return;

        setSelectedReturnItems(prev => {
            const existing = prev.find(i => i.id === orderItemId);
            if (quantity === 0) {
                return prev.filter(i => i.id !== orderItemId);
            }
            if (existing) {
                return prev.map(i => i.id === orderItemId ? { ...i, quantity } : i);
            }
            return [...prev, { id: orderItemId, quantity }];
        });
    };

    const fetchOrderDetail = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/orders/${id}`);
            setOrder(response.data);
        } catch (error) {
            logger.error("Error fetching order:", error);
            // toast.error("Failed to load order details");
            navigate("/my-orders");
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        fetchOrderDetail();
    }, [fetchOrderDetail]);

    const handleCancelOrder = async () => {
        try {
            setLoadingMessage("Cancelling your order...");
            setActionLoading(true);
            setCancelOpen(false);
            await apiClient.post(`/orders/${id}/cancel`, { reason: cancelReason });
            toast.success("Order cancelled successfully");
            fetchOrderDetail(); // Refresh
            fetchOrderDetail(); // Refresh
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to cancel order"));
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
        }
    };

    const handleReturnOrder = async () => {
        try {
            if (selectedReturnItems.length === 0) {
                toast.error("Please select at least one item to return");
                return;
            }
            setLoadingMessage("Submitting your return request...");
            setActionLoading(true);
            setReturnOpen(false);

            const itemsToReturn = selectedReturnItems.map(item => ({
                orderItemId: item.id,
                quantity: item.quantity
            }));

            await apiClient.post(`/returns/request`, {
                orderId: id,
                items: itemsToReturn,
                reason: returnReason
            });

            toast.success("Return request submitted");
            setReturnOpen(false);
            fetchOrderDetail();
            fetchOrderDetail();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to submit return request"));
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
        }
    };

    const fetchReturnableItems = async () => {
        try {
            const response = await apiClient.get(`/returns/orders/${id}/items`);
            setReturnableItems(response.data);
        } catch (error) {
            logger.error("Failed to fetch returnable items", error);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <LoadingOverlay isLoading={true} message="Loading order details..." />
        </div>
    );
    if (!order) return <div className="p-8 text-center">Order not found</div>;

    const canCancel = ['pending', 'confirmed'].includes(order.status);

    // Can return only if:
    // 1. Order status is 'delivered'
    // 2. At least one item is returnable (default to true if not specified)
    const canReturn = (() => {
        if (!['delivered', 'return_rejected'].includes(order.status)) return false;

        // If no items data, default to allowing return for delivered orders
        if (!order.items || order.items.length === 0) return true;

        // Check if any item is returnable
        // Default to returnable unless explicitly set to false
        const hasReturnableItems = order.items.some((item) => {
            const product = item.product;
            if (!product) return true;

            // Handle both camelCase and snake_case properties
            const p = product as Product & { is_returnable?: boolean };
            const isReturnable = p.isReturnable ?? p.is_returnable ?? true;
            return isReturnable !== false;
        });

        return hasReturnableItems;
    })();

    return (
        <>
            {/* Full-page loading overlay for actions */}
            <LoadingOverlay isLoading={actionLoading} message={loadingMessage} />

            <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/my-orders")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Order #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                        </h1>
                        <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                            <Badge variant="secondary" className="text-sm font-normal px-3 py-1">
                                {order.createdAt || order.created_at ? format(new Date(order.createdAt || order.created_at), "PPP") : "N/A"}
                            </Badge>
                            <span>•</span>
                            <Badge
                                variant={['delivered', 'completed'].includes(order.status) ? 'default' :
                                    ['cancelled', 'returned'].includes(order.status) ? 'destructive' : 'secondary'}
                                className="text-sm capitalize px-3 py-1"
                            >
                                {order.status.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                    </div>
                    <div className="ml-auto flex gap-2">
                        {/* Invoice Download */}
                        {order.invoice_url && (
                            <Button variant="outline" onClick={() => window.open(order.invoice_url, '_blank')}>
                                <FileText className="mr-2 h-4 w-4" /> Invoice
                            </Button>
                        )}

                        {/* Cancel Dialog */}
                        {canCancel && (
                            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive">
                                        <XCircle className="mr-2 h-4 w-4" /> Cancel Order
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Cancel Order</DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to cancel this order? This action cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 py-4">
                                        <Label>Reason for cancellation (optional)</Label>
                                        <Textarea
                                            placeholder="Changed my mind, found better price, etc."
                                            value={cancelReason}
                                            onChange={e => setCancelReason(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Order</Button>
                                        <Button variant="destructive" onClick={handleCancelOrder} disabled={actionLoading}>
                                            {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Return Dialog */}
                        {canReturn && (
                            <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                        onClick={fetchReturnableItems}
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" /> Request Return
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-xl">
                                            <RotateCcw className="h-5 w-5 text-orange-500" />
                                            Request Return
                                        </DialogTitle>
                                        <DialogDescription>
                                            Select the items you wish to return. Our team will review your request within 24-48 hours.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-5 py-4">
                                        {/* Item Selection */}
                                        <div className="space-y-3">
                                            <Label className="text-sm font-semibold flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                Select Items to Return
                                            </Label>
                                            <div className="rounded-lg border bg-muted/30 p-1 max-h-64 overflow-y-auto space-y-2">
                                                {returnableItems.length === 0 ? (
                                                    <div className="text-center py-8 text-muted-foreground">
                                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <p className="text-sm">No returnable items found</p>
                                                    </div>
                                                ) : (
                                                    returnableItems.map((item: ReturnableItem) => {
                                                        const selected = selectedReturnItems.find(i => i.id === item.id);
                                                        const isSelected = !!selected;

                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                                                                    ? 'bg-orange-50 border-orange-300 shadow-sm'
                                                                    : 'bg-white hover:bg-gray-50 border-gray-200'
                                                                    }`}
                                                                onClick={() => {
                                                                    handleReturnItemChange(
                                                                        item.id,
                                                                        !isSelected ? item.remaining_quantity : 0,
                                                                        item.remaining_quantity
                                                                    );
                                                                }}
                                                            >
                                                                <Checkbox
                                                                    id={`return-item-${item.id}`}
                                                                    checked={isSelected}
                                                                    onCheckedChange={(checked) => {
                                                                        handleReturnItemChange(
                                                                            item.id,
                                                                            checked ? item.remaining_quantity : 0,
                                                                            item.remaining_quantity
                                                                        );
                                                                    }}
                                                                    className={isSelected ? 'border-orange-500 data-[state=checked]:bg-orange-500' : ''}
                                                                />
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium">{item.title}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-xs text-muted-foreground">₹{item.price_per_unit}</span>
                                                                        <span className="text-xs text-muted-foreground">•</span>
                                                                        <span className="text-xs text-muted-foreground">Max: {item.remaining_quantity}</span>
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
                                                                        <button
                                                                            type="button"
                                                                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleReturnItemChange(item.id, Math.max(1, (selected?.quantity || 1) - 1), item.remaining_quantity);
                                                                            }}
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <span className="w-6 text-center text-sm font-medium">{selected?.quantity || 1}</span>
                                                                        <button
                                                                            type="button"
                                                                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleReturnItemChange(item.id, Math.min(item.remaining_quantity, (selected?.quantity || 1) + 1), item.remaining_quantity);
                                                                            }}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            {returnableItems.length > 0 && selectedReturnItems.length === 0 && (
                                                <p className="text-xs text-orange-600 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Please select at least one item to return
                                                </p>
                                            )}
                                        </div>

                                        {/* Reason Input */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold">Reason for Return *</Label>
                                            <Textarea
                                                placeholder="Please describe why you want to return these items..."
                                                value={returnReason}
                                                onChange={e => setReturnReason(e.target.value)}
                                                className="min-h-[80px] resize-none"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter className="gap-2 sm:gap-0">
                                        <Button variant="ghost" onClick={() => setReturnOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                                            onClick={handleReturnOrder}
                                            disabled={actionLoading || !returnReason.trim() || selectedReturnItems.length === 0}
                                        >
                                            {actionLoading ? (
                                                <>
                                                    <span className="animate-spin mr-2">⏳</span>
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    Submit Return Request
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column - Order Info */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Items */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" /> Order Items
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {order.items.map((item, index) => {
                                        // Get variant size label
                                        const sizeLabel = item.variant?.size_label || item.size_label;
                                        // Use variant image if available, otherwise use product image
                                        const displayImage = item.variant?.variant_image_url || item.product?.images?.[0];
                                        // Use price_per_unit from order item (reflects variant price at time of purchase)
                                        const unitPrice = item.price_per_unit || item.product?.price || 0;

                                        return (
                                            <div key={index} className="flex gap-4 items-start border-b pb-4 last:border-0 last:pb-0">
                                                <div className="w-16 h-16 bg-muted rounded-md overflow-hidden">
                                                    {displayImage && (
                                                        <img
                                                            src={displayImage}
                                                            alt={item.product?.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium">{item.product?.title || "Product"}</h4>
                                                        {sizeLabel && (
                                                            <Badge variant="secondary" className="text-xs font-normal">
                                                                {sizeLabel}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Qty: {item.quantity} × ₹{unitPrice}
                                                    </p>
                                                </div>
                                                <div className="text-right font-medium">
                                                    ₹{(item.quantity * unitPrice).toFixed(2)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <Separator className="my-4" />
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span>₹{order.subtotal?.toFixed(2) || (order.total_amount - (order.delivery_charge || 0)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Delivery Charge</span>
                                        <span>₹{order.delivery_charge?.toFixed(2) || "0.00"}</span>
                                    </div>
                                    <Separator className="my-2" />
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total Payable</span>
                                        <span>₹{(order.total_amount || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order Timeline */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" /> Order Timeline
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative border-l border-muted ml-2 space-y-6 pb-2">
                                    {(order.order_status_history || [])
                                        .slice() // Copy to sort
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Newest first
                                        .map((history, index) => (
                                            <div key={index} className="ml-6 relative">
                                                <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background ring-2 ring-muted" />
                                                <p className="font-medium text-sm capitalize">
                                                    {history.status.replace(/_/g, ' ')}
                                                </p>
                                                <p className="text-xs text-muted-foreground mb-1">
                                                    {format(new Date(history.created_at), "PPP p")}
                                                    {history.updater && (
                                                        <span className="ml-1">
                                                            • {(history.updater.role_data?.name === 'admin' || history.updater.role_data?.name === 'manager') ? 'Staff' : 'You'}
                                                        </span>
                                                    )}
                                                </p>
                                                {history.notes && (
                                                    <div className="bg-muted/50 p-2 rounded text-xs mt-1 text-gray-700 border border-muted">
                                                        {history.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    {(!order.order_status_history || order.order_status_history.length === 0) && (
                                        <p className="text-sm text-muted-foreground ml-6">No history available.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                    {/* Right Column - Info */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" /> Shipping Address
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                {order.shipping_address ? (
                                    <div className="space-y-1">
                                        <p className="font-medium">{order.shipping_address.full_name}</p>
                                        <p>{order.shipping_address.address_line1}</p>
                                        {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
                                        <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}</p>
                                        <p>{order.shipping_address.country}</p>
                                        <div className="mt-2 pt-2 border-t">
                                            <p className="text-muted-foreground">Phone: <span className="text-foreground">{order.shipping_address.phone}</span></p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic">Address not available</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" /> Billing Address
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                {order.billing_address ? (
                                    <div className="space-y-1">
                                        <p className="font-medium">{order.billing_address.full_name}</p>
                                        <p>{order.billing_address.address_line1}</p>
                                        {order.billing_address.address_line2 && <p>{order.billing_address.address_line2}</p>}
                                        <p>{order.billing_address.city}, {order.billing_address.state} {order.billing_address.postal_code}</p>
                                        <p>{order.billing_address.country}</p>
                                        <div className="mt-2 pt-2 border-t">
                                            <p className="text-muted-foreground">Phone: <span className="text-foreground">{order.billing_address.phone}</span></p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic">Same as shipping address</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" /> Payment Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Payment Status:</span>
                                        <Badge variant={(order.paymentStatus || order.payment_status) === 'paid' ? 'default' :
                                            (order.paymentStatus || order.payment_status) === 'refunded' ? 'destructive' :
                                                (order.paymentStatus || order.payment_status) === 'refund_initiated' ? 'outline' : 'secondary'}
                                            className="ml-2 uppercase">
                                            {(order.paymentStatus || order.payment_status)?.replace(/_/g, ' ')}
                                        </Badge>
                                        {(order.paymentStatus === 'refund_initiated' || order.payment_status === 'refund_initiated') && (
                                            <p className="text-xs text-orange-600 mt-1 font-medium">
                                                Refund Initiated. Processing time: 5-7 business days.
                                            </p>
                                        )}
                                    </div>
                                    {order.payment_method && (
                                        <div>
                                            <span className="text-muted-foreground">Payment Method:</span>
                                            <p className="text-sm font-medium capitalize">{order.payment_method}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-muted-foreground">Payment ID:</span>
                                        {order.payment_id && order.payment_id.startsWith('pay_') ? (
                                            <p className="font-mono text-xs mt-1 bg-muted p-1 rounded inline-block">{order.payment_id}</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic mt-1">
                                                {order.payment_id ? 'System Reference' : 'Not Available'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
