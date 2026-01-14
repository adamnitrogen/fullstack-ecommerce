import { logger } from "@/lib/logger";
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, MapPin, Phone, Mail, CreditCard, Package, Clock, Truck, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getErrorMessage } from "@/lib/errorUtils";
import { CheckoutAddress, Order, Product, CartItem, OrderItem, ReturnRequest } from "@/types";

interface OrderStatusHistory {
    status: string;
    created_at: string;
    updated_by: string;
    notes?: string;
    updater?: {
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        role_data?: {
            name: string;
        };
    };
}

interface OrderDetail {
    id: string;
    order_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    status: string;
    payment_status: string;
    total_amount: number;
    subtotal: number;
    coupon_discount: number;
    delivery_charge: number;
    created_at: string;
    shipping_address: CheckoutAddress;
    billing_address: CheckoutAddress;
    items: (CartItem & { product?: Product; title?: string; price?: number })[];
    payment_id: string;
    order_status_history?: OrderStatusHistory[];
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['packed', 'cancelled'],
    packed: ['shipped', 'cancelled'],
    shipped: ['out_for_delivery'],
    out_for_delivery: ['delivered', 'returned'],
    delivered: [], // Return requests are customer-initiated only
    return_requested: ['return_approved', 'return_rejected'],
    return_approved: ['returned'],
    returned: ['refunded'],
    cancelled: ['refunded'],
    refunded: []
};


export default function OrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [cancelReason, setCancelReason] = useState("");
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [activeReturnRequest, setActiveReturnRequest] = useState<ReturnRequest | null>(null);

    const fetchActiveReturn = useCallback(async () => {
        try {
            const response = await apiClient.get(`/returns/orders/${id}/active`);
            setActiveReturnRequest(response.data);
        } catch (error) {
            logger.error("Failed to fetch return details", error);
        }
    }, [id]);

    useEffect(() => {
        if (order && ['return_requested', 'return_approved', 'return_rejected'].includes(order.status)) {
            fetchActiveReturn();
        }
    }, [order, order?.status, fetchActiveReturn]);

    const fetchOrderDetail = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get(`/orders/${id}`);
            setOrder(response.data);
        } catch (error) {
            setError("Failed to load order details. Please try again later.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchOrderDetail();
    }, [fetchOrderDetail]);

    const openStatusConfirmation = (newStatus: string) => {
        setPendingStatus(newStatus);
        if (newStatus === 'return_rejected') {
            setRejectionReason(""); // Reset
            setRejectionDialogOpen(true);
        } else if (newStatus === 'cancelled') {
            setCancelReason(""); // Reset
            setCancelDialogOpen(true);
        } else {
            setConfirmDialogOpen(true);
        }
    };

    const handleStatusUpdate = async () => {
        if (!pendingStatus) return;
        setConfirmDialogOpen(false);
        setCancelDialogOpen(false);
        setRejectionDialogOpen(false);

        try {
            setUpdating(true);
            setLoadingMessage("Updating status...");

            // SPECIAL LOGIC: Return Approval/Rejection
            if ((pendingStatus === 'return_approved' || pendingStatus === 'return_rejected') && activeReturnRequest) {
                if (pendingStatus === 'return_approved') {
                    await apiClient.post(`/returns/${activeReturnRequest.id}/approve`, {});
                    toast.success("Return approved and refund processed");
                } else {
                    await apiClient.post(`/returns/${activeReturnRequest.id}/reject`, { reason: rejectionReason });
                    toast.success("Return rejected");
                }
                fetchOrderDetail(); // Refresh
                return;
            }

            const payload: Record<string, unknown> = { status: pendingStatus };
            if (pendingStatus === 'cancelled' && cancelReason.trim()) {
                payload.notes = `Cancelled by Admin: ${cancelReason}`;
            }

            const response = await apiClient.put(`/orders/${id}/status`, payload);
            // Refresh full order to get history too
            fetchOrderDetail();

            // Show appropriate toast based on refund status
            if (response.data?.refundInitiated) {
                toast.success(`Order status updated to ${pendingStatus}. Refund has been initiated!`, {
                    description: "The refund will be processed to the customer's original payment method.",
                    duration: 5000
                });
            } else {
                toast.success(`Order status updated to ${pendingStatus}`);
            }
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to update status"));
        } finally {
            setUpdating(false);
            setPendingStatus(null);
        }
    };

    if (loading) return <LoadingOverlay isLoading={true} message="Loading order details..." />;
    if (error) return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-red-600">
            <p className="text-lg font-semibold mb-2">Error</p>
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/orders')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
            </Button>
        </div>
    );
    if (!order) return <LoadingOverlay isLoading={true} message="Order not found..." />;

    const availableActions = ALLOWED_TRANSITIONS[order.status] || [];

    return (
        <div className="space-y-6">
            <LoadingOverlay isLoading={updating} message={loadingMessage} />

            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate("/admin/orders")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        Order {order.order_number}
                        <Badge variant="outline" className="text-base font-normal">
                            {order.created_at ? (
                                (() => {
                                    try {
                                        return format(new Date(order.created_at), "PPP p");
                                    } catch (e) {
                                        return "Invalid Date";
                                    }
                                })()
                            ) : (
                                "Date N/A"
                            )}
                        </Badge>
                    </h1>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {availableActions.map(action => (
                        <Button
                            key={action}
                            onClick={() => openStatusConfirmation(action)}
                            disabled={updating}
                            variant={action === 'cancelled' ? 'destructive' : 'default'}
                        >
                            Mark as {action.replace('return_', 'Return ').replace('_', ' ').toUpperCase()}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Active Return Request Details - Only show if pending action is needed */}
            {activeReturnRequest && activeReturnRequest.status === 'requested' && (
                <Card className="bg-purple-50 border-purple-200">
                    <CardHeader>
                        <CardTitle className="text-purple-800 flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Active Return Request
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between border-b border-purple-200 pb-2">
                            <span className="text-gray-600">Reason:</span>
                            <span className="font-medium text-right">{activeReturnRequest.reason}</span>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm mb-2 text-purple-800">Items Requested for Return:</h4>
                            <div className="space-y-2 bg-white p-3 rounded border border-purple-100">
                                {activeReturnRequest.return_items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-medium">{item.order_items?.title || item.product?.title || "Product"}</p>
                                            <p className="text-xs text-muted-foreground">Unit Price: ₹{item.order_items?.price_per_unit || (item.product?.price || 0)}</p>
                                        </div>
                                        <div className="font-bold">Qty: {item.quantity}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between pt-2">
                            <span className="font-bold text-gray-700">Estimated Refund Amount:</span>
                            <span className="font-bold text-xl text-purple-700">₹{activeReturnRequest.refund_amount}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column - Order Info */}
                <div className="md:col-span-2 space-y-6">
                    {/* Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Order Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {order.items.map((item, index) => (
                                    <div key={index} className="flex gap-4 items-start border-b pb-4 last:border-0 last:pb-0">
                                        <div className="w-16 h-16 bg-muted rounded-md overflow-hidden">
                                            {item.product?.images?.[0] && (
                                                <img
                                                    src={item.product.images[0]}
                                                    alt={item.product.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium">{item.product?.title || "Product"}</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Qty: {item.quantity} × ₹{item.product?.price || 0}
                                            </p>
                                        </div>
                                        <div className="text-right font-medium">
                                            ₹{(item.quantity * (item.product?.price || 0)).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>₹{order.subtotal.toFixed(2)}</span>
                                </div>
                                {order.coupon_discount > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Coupon Discount</span>
                                        <span>-₹{order.coupon_discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Delivery Charge</span>
                                    <span>₹{order.delivery_charge.toFixed(2)}</span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total Payable</span>
                                    <span>₹{(order.total_amount || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Payment Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Status</p>
                                    <Badge
                                        variant={
                                            order.payment_status === 'paid' ? 'default' :
                                                order.payment_status === 'refunded' ? 'destructive' :
                                                    order.payment_status === 'refund_initiated' ? 'outline' :
                                                        'secondary'
                                        }
                                        className={`mt-1 uppercase ${order.payment_status === 'refund_initiated' ? 'bg-blue-500 text-white' :
                                            order.payment_status === 'refunded' ? 'bg-green-500 text-white' : ''
                                            }`}
                                    >
                                        {order.payment_status?.replace(/_/g, ' ')}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Payment ID</p>
                                    <p className="font-mono mt-1">{order.payment_id || "N/A"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Status History */}
                    {order.order_status_history && order.order_status_history.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Order History
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {order.order_status_history.map((history, index) => (
                                        <div key={index} className="flex gap-4 items-start border-l-2 border-muted pl-4 ml-2 pb-4 last:pb-0">
                                            <div className="flex-1">
                                                <div className="font-medium text-sm flex items-center gap-2">
                                                    Status changed to <Badge variant="outline">{history.status.toUpperCase()}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {(() => {
                                                        const date = new Date(history.created_at);
                                                        return !isNaN(date.getTime()) ? format(date, "PPP p") : "Date N/A";
                                                    })()}
                                                    {history.updater ? (
                                                        <span className="ml-2">
                                                            by {history.updater.first_name || history.updater.email}
                                                            <span className="text-xs bg-muted px-1 rounded ml-1 uppercase border">
                                                                {history.updater.role_data?.name || 'N/A'}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="ml-2">by {history.updated_by || 'System'}</span>
                                                    )}
                                                </p>
                                                {history.notes && (
                                                    <p className="text-sm mt-1 text-gray-600">{history.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column - Customer & Address */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="font-medium">{order.customer_name}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Mail className="h-4 w-4" />
                                    {order.customer_email}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Phone className="h-4 w-4" />
                                    {order.customer_phone}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Shipping Address
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            {order.shipping_address ? (
                                <div className="space-y-1">
                                    <p className="font-medium">{order.shipping_address.full_name}</p>
                                    <p>{order.shipping_address.address_line1}</p>
                                    {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
                                    <p>
                                        {order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.postal_code}
                                    </p>
                                    <p>{order.shipping_address.country}</p>
                                    <p className="mt-2 text-muted-foreground">Phone: {order.shipping_address.phone}</p>
                                    {order.shipping_address.alternatePhone && (
                                        <p className="text-muted-foreground">Alt Phone: {order.shipping_address.alternatePhone}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">Address details not available</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Billing Address
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            {order.billing_address ? (
                                <div className="space-y-1">
                                    <p className="font-medium">{order.billing_address.full_name}</p>
                                    <p>{order.billing_address.address_line1}</p>
                                    {order.billing_address.address_line2 && <p>{order.billing_address.address_line2}</p>}
                                    <p>
                                        {order.billing_address.city}, {order.billing_address.state} - {order.billing_address.postal_code}
                                    </p>
                                    <p>{order.billing_address.country}</p>
                                    <p className="mt-2 text-muted-foreground">Phone: {order.billing_address.phone}</p>
                                    {order.billing_address.alternatePhone && (
                                        <p className="text-muted-foreground">Alt Phone: {order.billing_address.alternatePhone}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">Same as shipping address</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Status Update Confirmation Dialog */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to change the order status to{" "}
                            <span className="font-semibold uppercase">{pendingStatus?.replace('_', ' ')}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPendingStatus(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleStatusUpdate}
                            disabled={updating}
                        >
                            {updating ? "Updating..." : "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rejection Reason Dialog */}
            <AlertDialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Return Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please provide a reason for rejecting this return request. This will be visible to the customer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <textarea
                            id="rejection-reason"
                            name="rejectionReason"
                            aria-label="Reason for rejection"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setRejectionDialogOpen(false);
                            setPendingStatus(null);
                        }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleStatusUpdate}
                            disabled={!rejectionReason.trim() || updating}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {updating ? "Rejecting..." : "Reject Return"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Admin Cancellation Reason Dialog */}
            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please provide a reason for cancelling this order. This message will be shown in the order timeline.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <textarea
                            id="cancellation-reason"
                            name="cancellationReason"
                            aria-label="Reason for cancellation"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Reason for cancellation..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setCancelDialogOpen(false);
                            setPendingStatus(null);
                        }}>
                            Go Back
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleStatusUpdate}
                            disabled={!cancelReason.trim() || updating}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {updating ? "Cancelling..." : "Confirm Cancellation"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
