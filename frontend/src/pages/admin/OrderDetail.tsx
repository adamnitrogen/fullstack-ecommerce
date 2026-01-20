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
import { ArrowLeft, MapPin, Phone, Mail, CreditCard, Package, Clock, Truck, User, FileText, Info, IndianRupee, RotateCcw, CheckSquare, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getErrorMessage } from "@/lib/errorUtils";
import { CheckoutAddress, Order, Product, CartItem, OrderItem } from "@/types";
import { TaxBreakdown } from "@/components/orders/TaxBreakdown";
import { RegenerateInvoiceButton } from "@/components/orders/RegenerateInvoiceButton";

interface OrderStatusHistory {
    status: string;
    event_type?: string;
    actor?: string;
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

interface ReturnRequestItem {
    id: string;
    product_id: string;
    quantity: number;
    reason: string;
    images?: string[];
    condition?: string;
    status: 'requested' | 'approved' | 'picked_up' | 'item_returned';
    order_item_id: string;
    order_items?: {
        id: string;
        title: string;
        price_per_unit: number;
        quantity: number;
        cgst?: number;
        sgst?: number;
        igst?: number;
        variant_snapshot?: {
            size_label?: string;
            [key: string]: any;
        };
    } | Array<{
        id: string;
        title: string;
        price_per_unit: number;
        quantity: number;
        cgst?: number;
        sgst?: number;
        igst?: number;
        variant_snapshot?: {
            size_label?: string;
            [key: string]: any;
        };
    }>;
}

interface ReturnRequest {
    id: string;
    user_id: string;
    status: 'requested' | 'approved' | 'pickup_scheduled' | 'picked_up' | 'item_returned' | 'rejected' | 'cancelled' | 'completed';
    reason: string;
    refund_amount: number;
    created_at: string;
    updated_at: string;
    staff_notes?: string;
    refund_breakdown?: any;
    return_items: ReturnRequestItem[];
}

interface OrderDetailItem {
    id: string;
    product_id: string;
    quantity: number;
    price_per_unit: number;
    title: string;
    image?: string;
    product?: Product;
    variant_id?: string;
    variant?: {
        id: string;
        size_label: string;
        size_value: number;
        unit: string;
        variant_image_url?: string;
    };
    variant_snapshot?: {
        variant_id?: string;
        size_label?: string;
        selling_price?: number;
        mrp?: number;
        variant_image_url?: string;
        [key: string]: any;
    };
    size_label?: string;
    hsn_code?: string;
    gst_rate?: number;
    taxable_amount?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    delivery_charge?: number;
    delivery_gst?: number;
    delivery_calculation_snapshot?: any;
    price?: number; // fallback
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
    delivery_gst?: number;
    shipping_address: CheckoutAddress;
    billing_address: CheckoutAddress;
    items: OrderDetailItem[];
    payment_id: string;
    order_status_history?: OrderStatusHistory[];
    email_logs?: EmailLog[];
    total_taxable_amount?: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    invoice_id?: string;
    invoice_url?: string;
    invoices?: Array<{
        id: string;
        type: 'RAZORPAY' | 'TAX_INVOICE' | 'BILL_OF_SUPPLY';
        public_url?: string;
        invoice_number: string;
        status: string;
        created_at: string;
    }>;
    refunds?: Array<{
        id: string;
        razorpay_refund_id?: string;
        amount: number;
        status: string;
        notes?: string;
        created_at: string;
    }>;
}

interface EmailLog {
    id: string;
    type: string;
    recipient: string;
    status: string;
    error_message?: string;
    retry_count: number;
    created_at: string;
    event_type: string;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['packed', 'cancelled'],
    packed: ['shipped', 'cancelled'],
    shipped: ['out_for_delivery'],
    out_for_delivery: ['delivered', 'returned'],
    delivered: [],
    return_requested: ['return_approved', 'return_rejected'],
    return_approved: ['partially_returned', 'returned'],
    partially_returned: [],
    returned: [],
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
    const [pendingReturnId, setPendingReturnId] = useState<string | null>(null);
    const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);

    const fetchReturns = useCallback(async () => {
        try {
            const response = await apiClient.get(`/returns/orders/${id}/all`);
            setReturnRequests(response.data);
        } catch (error) {
            logger.error("Failed to fetch returns", error);
        }
    }, [id]);

    useEffect(() => {
        fetchReturns();
    }, [fetchReturns]);

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
            // (Compatibility fallback for old single active return logic)
            const activeRet = returnRequests.find(r => r.status === 'requested' || r.status === 'pickup_scheduled' || r.status === 'picked_up');
            if ((pendingStatus === 'return_approved' || pendingStatus === 'return_rejected') && activeRet) {
                await handleReturnAction(
                    activeRet.id,
                    pendingStatus === 'return_approved' ? 'approve' : 'reject',
                    pendingStatus === 'return_rejected' ? rejectionReason : undefined
                );
                return;
            }

            const payload: Record<string, unknown> = { status: pendingStatus };
            if (pendingStatus === 'cancelled' && cancelReason.trim()) {
                payload.notes = `Cancelled by Admin: ${cancelReason}`;
            }

            const response = await apiClient.put(`/orders/${id}/status`, payload);
            fetchOrderDetail();

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
            setRejectionReason("");
        }
    };

    const handleReturnAction = async (returnId: string, action: 'picked_up' | 'approve' | 'reject', notes?: string) => {
        if (action === 'reject' && !notes) {
            setPendingReturnId(returnId);
            setRejectionReason("");
            setRejectionDialogOpen(true);
            return;
        }

        try {
            setUpdating(true);
            setLoadingMessage(`${action.replace('_', ' ')} logic...`);

            if (action === 'picked_up') {
                await apiClient.post(`/returns/${returnId}/status`, { status: 'picked_up', notes });
                toast.success("Return marked as Picked Up");
            } else if (action === 'approve') {
                await apiClient.post(`/returns/${returnId}/approve`, { notes });
                toast.success("Return approved");
            } else if (action === 'reject') {
                await apiClient.post(`/returns/${returnId}/reject`, { reason: notes });
                toast.success("Return rejected");
            }

            fetchOrderDetail();
            fetchReturns();
        } catch (error) {
            toast.error(getErrorMessage(error, `Failed to ${action}`));
        } finally {
            setUpdating(false);
            setLoadingMessage("");
            setPendingReturnId(null);
        }
    };

    const handleReturnItemStatus = async (item: ReturnRequestItem, status: string) => {
        try {
            setUpdating(true);
            setLoadingMessage(`Updating item status to ${status}...`);

            await apiClient.post(`/returns/items/${item.id}/status`, { status });
            toast.success(`Item marked as ${status.replace('_', ' ')}`);

            fetchOrderDetail();
            fetchReturns();
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to update item status"));
        } finally {
            setUpdating(false);
            setLoadingMessage("");
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
                    {availableActions
                        .filter(action => {
                            // Hide return approval/rejection from header if managed via return requests box
                            if (returnRequests && returnRequests.length > 0) {
                                return !['return_approved', 'return_rejected', 'return_requested'].includes(action);
                            }
                            return true;
                        })
                        .map(action => (
                            <Button
                                key={action}
                                size="sm"
                                onClick={() => openStatusConfirmation(action)}
                                disabled={updating}
                                variant={action === 'cancelled' ? 'destructive' : 'default'}
                            >
                                Mark as {action.replace('return_', 'Return ').replace('_', ' ').toUpperCase()}
                            </Button>
                        ))}
                </div>
            </div>

            {/* NEW: Comprehensive Return Management Section */}
            {returnRequests.length > 0 && (
                <Card className="bg-slate-50 border-slate-200 shadow-sm">
                    <CardHeader className="py-4 bg-white/50 border-b">
                        <CardTitle className="text-slate-800 flex items-center gap-2 text-lg">
                            <RotateCcw className="h-5 w-5 text-indigo-600" />
                            Return Management Requests ({returnRequests.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {returnRequests.map((ret) => (
                                <div key={ret.id} className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Badge variant={
                                                ret.status === 'approved' ? 'default' :
                                                    ret.status === 'rejected' ? 'destructive' :
                                                        ret.status === 'cancelled' ? 'secondary' :
                                                            ret.status === 'picked_up' ? 'outline' : 'secondary'
                                            } className={`capitalize ${ret.status === 'approved' ? 'bg-green-600 text-white' :
                                                ret.status === 'picked_up' ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                                    ret.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : ''}`}>
                                                {ret.status.replace('_', ' ')}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground">
                                                ID: <span className="font-mono">{ret.id.split('-')[0]}</span> • {format(new Date(ret.created_at), "MMM d, h:mm a")}
                                            </div>
                                        </div>

                                        {/* Actions for Pending Transitions */}
                                        <div className="flex items-center gap-2">
                                            {ret.status === 'approved' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                                    onClick={() => handleReturnAction(ret.id, 'picked_up')}
                                                    disabled={updating}
                                                >
                                                    <Truck className="h-3.5 w-3.5 mr-1" /> Mark Picked Up
                                                </Button>
                                            )}
                                            {ret.status === 'requested' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleReturnAction(ret.id, 'approve')}
                                                        disabled={updating}
                                                    >
                                                        <CheckSquare className="h-3.5 w-3.5 mr-1" /> Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-red-600 hover:bg-red-50"
                                                        onClick={() => handleReturnAction(ret.id, 'reject')}
                                                        disabled={updating}
                                                    >
                                                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items List for this return */}
                                    <div className="bg-white p-3 rounded border border-slate-200 space-y-3">
                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Requested Items</p>
                                        {ret.return_items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start text-sm border-b last:border-0 pb-2 last:pb-0">
                                                <div>
                                                    <div className="font-medium flex items-center gap-2">
                                                        {(() => {
                                                            const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                                                            return orderItem?.title;
                                                        })()}
                                                        {(() => {
                                                            const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                                                            return orderItem?.variant_snapshot?.size_label && (
                                                                <Badge variant="secondary" className="text-[10px] h-4 font-normal">
                                                                    {orderItem.variant_snapshot.size_label}
                                                                </Badge>
                                                            );
                                                        })()}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground italic mt-0.5">"Reason: {item.reason}"</p>
                                                    {item.images && item.images.length > 0 && (
                                                        <div className="flex gap-1 mt-2">
                                                            {item.images.map((img, i) => (
                                                                <img
                                                                    key={i}
                                                                    src={img}
                                                                    className="w-10 h-10 object-cover rounded border cursor-pointer hover:opacity-80"
                                                                    onClick={() => window.open(img, '_blank')}
                                                                    alt="return proof"
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="font-bold">Qty: {item.quantity}</div>
                                                        <div className="text-[10px] text-muted-foreground mt-1">
                                                            ₹{(() => {
                                                                const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                                                                // Calculate inclusive unit price if possible
                                                                const base = orderItem?.price_per_unit || 0;
                                                                const tax = (orderItem?.cgst || 0) + (orderItem?.sgst || 0) + (orderItem?.igst || 0);
                                                                const unitTax = tax / (orderItem?.quantity || 1);
                                                                return (base + unitTax).toFixed(2);
                                                            })()}/unit (incl. tax)
                                                        </div>
                                                    </div>
                                                    {ret.status === 'picked_up' && (
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant={item.status === 'item_returned' ? 'default' : 'outline'} className={item.status === 'item_returned' ? 'bg-green-600' : ''}>
                                                                {item.status?.replace('_', ' ') || 'Picked Up'}
                                                            </Badge>
                                                            {item.status !== 'item_returned' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className="h-7 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-700"
                                                                    onClick={() => handleReturnItemStatus(item, 'item_returned')}
                                                                    disabled={updating}
                                                                >
                                                                    Mark Returned
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="pt-2 border-t border-dashed space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-semibold">Refund Impact</span>
                                                <span className="text-sm font-bold text-indigo-700">₹{ret.refund_amount.toFixed(2)}</span>
                                            </div>
                                            {ret.refund_breakdown && (
                                                <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-100 pt-1">
                                                    <div className="flex justify-between text-[10px] text-slate-500">
                                                        <span>Products (incl. tax):</span>
                                                        <span>₹{(ret.refund_breakdown.totalRefund || 0).toFixed(2)}</span>
                                                    </div>
                                                    {(ret.refund_breakdown.totalDeliveryRefund > 0) && (
                                                        <div className="flex justify-between text-[10px] text-indigo-600 font-medium">
                                                            <span>Delivery Refund:</span>
                                                            <span>₹{ret.refund_breakdown.totalDeliveryRefund.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {ret.staff_notes && (
                                        <p className="text-[10px] text-slate-500 italic bg-slate-100 p-2 rounded">
                                            Admin Note: {ret.staff_notes}
                                        </p>
                                    )}
                                </div>
                            ))}
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
                                {(() => {
                                    // Calculate Non-Refundable Total to Bundle
                                    const refundableTotal = (order.items || []).reduce((sum: number, item: OrderDetailItem) => {
                                        const snapshot = item.delivery_calculation_snapshot || {};
                                        if (snapshot.source !== 'global' && snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                            return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                        }
                                        return sum;
                                    }, 0);

                                    const deliveryTotal = (order.delivery_charge || 0) + (order.delivery_gst || 0);
                                    const nonRefundableTotalToBundle = Math.max(0, deliveryTotal - refundableTotal);

                                    const itemsTotalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price_per_unit || item.price || item.product?.price || item.variant_snapshot?.selling_price || 0)), 0);

                                    return order.items.map((item, index) => {
                                        // Get variant size label
                                        const sizeLabel = item.variant_snapshot?.size_label || item.variant?.size_label || item.size_label;
                                        // Use variant image if available, otherwise use product image
                                        const displayImage = item.variant_snapshot?.variant_image_url || item.variant?.variant_image_url || item.product?.images?.[0];
                                        const itemTitle = item.title || item.product?.title || "Product";

                                        // Bundling Logic Removed for Clarity
                                        const rawUnitPrice = item.price_per_unit || item.price || item.product?.price || item.variant_snapshot?.selling_price || 0;
                                        const bundledUnitPrice = rawUnitPrice;

                                        return (
                                            <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                                                <div className="flex gap-4 items-start">
                                                    <div className="w-16 h-16 bg-muted rounded-md overflow-hidden">
                                                        {displayImage && (
                                                            <img
                                                                src={displayImage}
                                                                alt={itemTitle}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium">{itemTitle}</h4>
                                                            {sizeLabel && (
                                                                <Badge variant="secondary" className="text-xs font-normal">
                                                                    {sizeLabel}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            Qty: {item.quantity} × ₹{bundledUnitPrice.toFixed(2)}
                                                            <span className="text-xs ml-2 text-muted-foreground/80">
                                                                ({(item.product?.price_includes_tax ?? item.product?.default_price_includes_tax ?? true) ? 'Inc. Tax' : 'Excl. Tax'})
                                                            </span>
                                                        </p>
                                                        {/* Base Price Display */}
                                                        {(() => {
                                                            const gstRate = item.gst_rate || item.product?.gstRate || item.product?.gst_rate || item.product?.default_gst_rate || 0;
                                                            const baseUnitPrice = gstRate > 0 ? bundledUnitPrice / (1 + gstRate / 100) : bundledUnitPrice;
                                                            return (
                                                                <p className="text-xs text-slate-500">
                                                                    Base Price: ₹{baseUnitPrice.toFixed(2)} (Excl. Tax)
                                                                </p>
                                                            );
                                                        })()}
                                                        {(item.gst_rate || 0) > 0 && (
                                                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                                <p>Generic Tax: {item.gst_rate}% (HSN: {item.hsn_code || 'N/A'})</p>
                                                                <div className="flex gap-2">
                                                                    {item.cgst ? <span>CGST: ₹{item.cgst}</span> : null}
                                                                    {item.sgst ? <span>SGST: ₹{item.sgst}</span> : null}
                                                                    {item.igst ? <span>IGST: ₹{item.igst}</span> : null}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right font-medium">
                                                        ₹{(item.quantity * bundledUnitPrice).toFixed(2)}
                                                    </div>
                                                </div>
                                                {item.delivery_calculation_snapshot && (
                                                    <div className="ml-20 mt-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed border-muted-foreground/20 max-w-md">
                                                        <div className="flex items-center gap-1.5 font-medium text-[10px] uppercase tracking-wider mb-1 text-primary">
                                                            <Truck className="h-3 w-3" />
                                                            Delivery Details
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                            <p>Method: <span className="font-medium">{item.delivery_calculation_snapshot.calculation_type?.replace(/_/g, ' ')}</span></p>
                                                            <p>Charge: <span className="font-medium">₹{Number(item.delivery_calculation_snapshot.delivery_charge).toFixed(2)}</span></p>
                                                            {item.delivery_gst ? <p>GST (18%): <span className="font-medium">₹{item.delivery_gst}</span></p> : null}
                                                            {item.delivery_calculation_snapshot.policy && (
                                                                <p className={item.delivery_calculation_snapshot.policy === 'NON_REFUNDABLE' ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                                                                    {item.delivery_calculation_snapshot.policy === 'NON_REFUNDABLE' ? 'Non-Refundable' : 'Refundable'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-2 text-sm">
                                {(() => {
                                    const refundableTotal = (order.items || []).reduce((sum: number, item: OrderDetailItem) => {
                                        const snapshot = item.delivery_calculation_snapshot || {};
                                        if (snapshot.source !== 'global' && snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                            return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                        }
                                        return sum;
                                    }, 0);

                                    const deliveryTotal = (order.delivery_charge || 0) + (order.delivery_gst || 0);
                                    const nonRefundableTotalToBundle = Math.max(0, deliveryTotal - refundableTotal);
                                    const subtotalToDisplay = order.subtotal + nonRefundableTotalToBundle;

                                    return (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Subtotal</span>
                                                <span>₹{subtotalToDisplay.toFixed(2)}</span>
                                            </div>
                                            {order.coupon_discount > 0 && (
                                                <div className="flex justify-between text-green-600">
                                                    <span>Coupon Discount</span>
                                                    <span>-₹{order.coupon_discount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {refundableTotal > 0 && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                                        Delivery & Handling
                                                        <Badge variant="outline" className="text-[10px] h-4 font-normal text-blue-600 border-blue-200 bg-blue-50">Refundable</Badge>
                                                    </span>
                                                    <span>₹{refundableTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
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
                                        className={`mt-1 uppercase ${order.payment_status === 'paid' ? 'bg-green-600 text-white' :
                                            order.payment_status === 'refund_initiated' ? 'bg-blue-500 text-white' :
                                                order.payment_status === 'refunded' ? 'bg-red-500 text-white' : ''}`}
                                    >
                                        {order.payment_status === 'partially_refunded' ? 'Partially Refunded' : order.payment_status?.replace(/_/g, ' ')}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Original Transaction Amount</p>
                                    <p className="font-medium mt-1">₹{(order.total_amount || 0).toFixed(2)}</p>
                                </div>

                                {order.payment_id && (
                                    <div className="col-span-2 pt-2 border-t border-dashed mt-2">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Razorpay Metadata</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-muted-foreground text-[11px]">Payment ID</p>
                                                <code className="bg-muted px-1 rounded text-[10px] break-all">{order.payment_id}</code>
                                            </div>
                                            {order.invoice_id && (
                                                <div>
                                                    <p className="text-muted-foreground text-[11px]">Invoice ID</p>
                                                    <code className="bg-muted px-1 rounded text-[10px] break-all">{order.invoice_id}</code>
                                                </div>
                                            )}
                                        </div>

                                        {/* Refund Metadata Display */}
                                        {order.refunds && order.refunds.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[10px] text-red-600 uppercase tracking-widest font-semibold">Refunds Processed</p>
                                                {order.refunds.map((ref, idx) => (
                                                    <div key={idx} className="grid grid-cols-2 gap-4 bg-red-50/50 p-2 rounded border border-red-100/50">
                                                        <div>
                                                            <p className="text-muted-foreground text-[11px]">Refund ID ({ref.status})</p>
                                                            <code className="bg-white px-1 rounded text-[10px] break-all text-red-700 border border-red-100">{ref.razorpay_refund_id || ref.id}</code>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-muted-foreground text-[11px]">Amount</p>
                                                            <span className="text-xs font-medium text-red-700">₹{(ref.amount || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {order.payment_status === 'partially_refunded' && (
                                    <div className="col-span-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-2 mt-2">
                                        <Info size={14} className="mt-0.5 shrink-0" />
                                        <p>
                                            <strong>Admin Note:</strong> This order has been partially refunded.
                                            The breakdown in the Tax Summary reflects the fully loaded financials.
                                        </p>
                                    </div>
                                )}
                            </div>


                            {/* Dual Invoice Downloads */}
                            <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                                <p className="text-xs font-medium text-muted-foreground uppercase">Linked Documents</p>
                                <div className="flex gap-2 flex-wrap">
                                    {/* 1. Razorpay Receipt */}
                                    {order.invoices?.find(i => i.type === 'RAZORPAY')?.public_url ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                            onClick={() => window.open(order.invoices?.find(i => i.type === 'RAZORPAY')?.public_url, '_blank')}
                                        >
                                            <FileText className="mr-1.5 h-3 w-3" /> Razorpay Receipt
                                        </Button>
                                    ) : (
                                        order.payment_status === 'paid' && (
                                            <span className="text-xs text-muted-foreground italic">Receipt pending...</span>
                                        )
                                    )}

                                    {/* 2. Tax Invoice - Only show for DELIVERED orders */}
                                    {order.status === 'delivered' && (order.invoice_url || order.invoices?.find(i => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type))) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => {
                                                const internalInv = order.invoices?.find(i => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type));
                                                const url = order.invoice_url || (internalInv ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/invoices/${internalInv.id}/download` : null);
                                                if (url) {
                                                    const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${url}`;
                                                    window.open(fullUrl, '_blank');
                                                }
                                            }}
                                        >
                                            <FileText className="mr-1.5 h-3 w-3" /> Invoice
                                        </Button>
                                    )}
                                </div>
                            </div>

                        </CardContent>
                    </Card>

                    {/* Order History Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Timeline & Audit Log
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {(() => {
                                    const historyItems = [...(order.order_status_history || [])];

                                    // Ensure "Order Placed" exists based on order creation date
                                    const hasPlaced = historyItems.some(h =>
                                        ['pending', 'ORDER_PLACED'].includes(h.status) ||
                                        h.event_type === 'ORDER_PLACED'
                                    );

                                    if (!hasPlaced && order.created_at) {
                                        historyItems.push({
                                            status: 'pending',
                                            event_type: 'ORDER_PLACED',
                                            created_at: order.created_at,
                                            notes: 'Order placed successfully.',
                                            actor: 'SYSTEM',
                                            updated_by: 'SYSTEM'
                                        } as OrderStatusHistory);
                                    }

                                    return historyItems
                                        .slice()
                                        .sort((a, b) => {
                                            const dateA = new Date(a.created_at).getTime();
                                            const dateB = new Date(b.created_at).getTime();
                                            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
                                        })
                                        .map((history, idx) => {
                                            let formattedDate = "Date N/A";
                                            try {
                                                formattedDate = format(new Date(history.created_at), "MMM d, HH:mm");
                                            } catch (e) {
                                                formattedDate = "Invalid Date";
                                            }

                                            return (
                                                <div key={idx} className="relative pl-6 pb-4 last:pb-0">
                                                    {/* Connector */}
                                                    {idx !== historyItems.length - 1 && (
                                                        <div className="absolute left-2.5 top-2 bottom-0 w-[1px] bg-muted" />
                                                    )}
                                                    {/* Dot */}
                                                    <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full border bg-background z-10 flex items-center justify-center">
                                                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-sm font-semibold capitalize flex items-center gap-2">
                                                                {/* Prefer Event Type for display if set, else status */}
                                                                <span>{(history.event_type || history.status || 'Unknown').replace(/_/g, ' ')}</span>

                                                                {/* Show Refund Amount in Tagline */}
                                                                {(history.event_type === 'REFUND_COMPLETED' || history.event_type === 'REFUND_PARTIAL') && order.refunds?.some(r => {
                                                                    try {
                                                                        return Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime()) < 60000;
                                                                    } catch { return false; }
                                                                }) && (
                                                                        <Badge variant="outline" className="text-[10px] h-5 font-normal border-green-200 bg-green-50 text-green-700">
                                                                            ₹{order.refunds.find(r => {
                                                                                try {
                                                                                    return Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime()) < 60000;
                                                                                } catch { return false; }
                                                                            })?.amount}
                                                                        </Badge>
                                                                    )}
                                                            </p>
                                                            <time className="text-[10px] text-muted-foreground">
                                                                {formattedDate}
                                                            </time>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1 bg-muted/20 p-2 rounded italic">
                                                            {history.notes || `Transitioned to ${history.status}`}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                                                            <User size={10} />
                                                            {/* Show Actor explicitly if available */}
                                                            {history.actor ? (
                                                                <span className="font-medium">{history.actor}</span>
                                                            ) : history.updater ? (
                                                                <span>{history.updater.first_name || history.updater.email} ({history.updater.role_data?.name || 'Staff'})</span>
                                                            ) : (
                                                                <span>{history.updated_by || 'System'}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        });
                                })()}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Email History */}
                    {
                        order.email_logs && order.email_logs.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Mail className="h-5 w-5" />
                                        Email Notifications
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {order.email_logs.map((email: EmailLog, index: number) => (
                                            <div key={index} className="flex gap-4 items-start border-l-2 border-muted pl-4 ml-2 pb-4 last:pb-0">
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-sm">{(email.event_type || 'Unknown').replace(/_/g, ' ')}</span>
                                                        <Badge
                                                            variant={email.status === 'SENT' ? 'default' : email.status === 'FAILED' ? 'destructive' : 'secondary'}
                                                            className={`text-xs ${email.status === 'SENT' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' : ''}`}
                                                        >
                                                            {email.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <p className="text-xs text-muted-foreground">
                                                            To: {email.recipient}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {(() => {
                                                                try {
                                                                    return format(new Date(email.created_at), "MMM d, h:mm a");
                                                                } catch (e) {
                                                                    return "Date N/A";
                                                                }
                                                            })()}
                                                        </p>
                                                    </div>
                                                    {email.status === 'FAILED' && (
                                                        <p className="text-xs text-red-600 mt-1 font-medium bg-red-50 p-1.5 rounded border border-red-100">
                                                            Error: {email.error_message || 'Unknown error'} (Retries: {email.retry_count})
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    }
                </div >

                {/* Right Column - Customer & Address */}
                < div className="space-y-6" >
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
                                    {order.customer_phone || 'N/A'}
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

                    <TaxBreakdown
                        totalTaxableAmount={(() => {
                            const storedSum = (order.total_taxable_amount || 0) + (order.total_cgst || 0) + (order.total_sgst || 0) + (order.total_igst || 0);
                            const totalAmount = order.total_amount || 0;
                            // Reconcile if total_taxable_amount seems to exclude delivery (migration artifact)
                            const isLegacyMismatch = Math.abs(totalAmount - storedSum) > 1.0;
                            return isLegacyMismatch ? (order.total_taxable_amount || 0) + (order.delivery_charge || 0) : (order.total_taxable_amount || 0);
                        })()}
                        totalCgst={order.total_cgst}
                        totalSgst={order.total_sgst}
                        totalIgst={order.total_igst}
                        totalAmount={order.total_amount}
                        showInvoiceLink={order.status === 'delivered' || !!order.invoice_url || (order.invoices && order.invoices.length > 0)}
                        invoiceUrl={order.invoice_url || order.invoices?.find(i => i.type === 'RAZORPAY')?.public_url}
                        items={order.items || []}
                        deliveryCharge={order.delivery_charge || 0}
                        deliveryGST={order.delivery_gst || 0}
                        role="admin"
                    />

                    {
                        order.payment_status === 'paid' && (
                            <Card>
                                <CardContent className="pt-6">
                                    <RegenerateInvoiceButton
                                        orderId={order.id}
                                        onSuccess={fetchOrderDetail}
                                        className="w-full"
                                    />
                                </CardContent>
                            </Card>
                        )
                    }
                </div >
            </div >

            {/* Status Update Confirmation Dialog */}
            < AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen} >
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
            </AlertDialog >

            {/* Rejection Reason Dialog */}
            < AlertDialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen} >
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
                            onClick={async () => {
                                if (pendingReturnId) {
                                    await handleReturnAction(pendingReturnId, 'reject', rejectionReason);
                                    setRejectionDialogOpen(false);
                                } else {
                                    handleStatusUpdate();
                                }
                            }}
                            disabled={!rejectionReason.trim() || updating}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {updating ? "Rejecting..." : "Reject Return"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            {/* Admin Cancellation Reason Dialog */}
            < AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} >
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
            </AlertDialog >
        </div >
    );
}
