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
import { ArrowLeft, MapPin, Phone, Mail, CreditCard, Package, Clock, Truck, User, FileText, Info, IndianRupee, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getErrorMessage } from "@/lib/errorUtils";
import { CheckoutAddress, Order, Product, CartItem, OrderItem, ReturnRequest } from "@/types";
import { TaxBreakdown } from "@/components/orders/TaxBreakdown";
import { InvoiceActions } from "@/components/orders/InvoiceActions";
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
    // Delivery fields (explicit)
    delivery_gst?: number;
    shipping_address: CheckoutAddress;
    billing_address: CheckoutAddress;
    items: (CartItem & {
        product?: Product;
        title?: string;
        price?: number;
        price_per_unit?: number;
        variant_id?: string;
        variant?: {
            id: string;
            size_label: string;
            size_value: number;
            unit: string;
            variant_image_url?: string;
        };
        size_label?: string;
        hsn_code?: string;
        gst_rate?: number;
        taxable_amount?: number;
        cgst?: number;
        sgst?: number;
        igst?: number;
        delivery_gst?: number;
        delivery_calculation_snapshot?: any;
    })[];
    payment_id: string;
    order_status_history?: OrderStatusHistory[];
    // GST Tax fields
    total_taxable_amount?: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    invoice_id?: string;
    invoice_url?: string;
    invoice_status?: string;
    invoices?: Array<{
        id: string;
        type: 'RAZORPAY' | 'TAX_INVOICE' | 'BILL_OF_SUPPLY';
        public_url?: string;
        invoice_number: string;
        status: string;
        created_at: string;
    }>;
    email_logs?: {
        id: string;
        event_type: string;
        recipient: string;
        status: string;
        created_at: string;
        retry_count: number;
        error_message?: string;

    }[];
    refunds?: {
        id: string;
        razorpay_refund_id: string;
        amount: number;
        status: string;
        notes?: string;
        created_at: string;
    }[];
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
                                {(() => {
                                    // Calculate Non-Refundable Total to Bundle
                                    const refundableTotal = (order.items || []).reduce((sum: number, item: any) => {
                                        const snapshot = item.delivery_calculation_snapshot || {};
                                        if (snapshot.source !== 'global' && snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                            return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                        }
                                        return sum;
                                    }, 0);

                                    const deliveryTotal = (order.delivery_charge || 0) + (order.delivery_gst || 0);
                                    const nonRefundableTotalToBundle = Math.max(0, deliveryTotal - refundableTotal);

                                    // Total for pro-rating
                                    const itemsTotalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price_per_unit || item.price || item.product?.price || 0)), 0);

                                    return order.items.map((item, index) => {
                                        // Get variant size label
                                        const sizeLabel = item.variant?.size_label || item.size_label;
                                        // Use variant image if available, otherwise use product image
                                        const displayImage = item.variant?.variant_image_url || item.product?.images?.[0];

                                        // Calculate Bundled Price
                                        const rawUnitPrice = item.price_per_unit || item.price || item.product?.price || 0;
                                        const itemTotalRaw = item.quantity * rawUnitPrice;

                                        let bundledUnitPrice = rawUnitPrice;
                                        if (nonRefundableTotalToBundle > 0 && itemsTotalAmount > 0) {
                                            const portion = (itemTotalRaw / itemsTotalAmount) * nonRefundableTotalToBundle;
                                            bundledUnitPrice = rawUnitPrice + (portion / item.quantity);
                                        }

                                        return (
                                            <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                                                <div className="flex gap-4 items-start">
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
                                                            Qty: {item.quantity} × ₹{bundledUnitPrice.toFixed(2)}
                                                            <span className="text-xs ml-2 text-muted-foreground/80">
                                                                ({(item.product?.price_includes_tax ?? item.product?.default_price_includes_tax ?? true) ? 'Inc. Tax' : 'Excl. Tax'})
                                                            </span>
                                                        </p>
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
                                                            <p>Charge: <span className="font-medium">₹{item.delivery_calculation_snapshot.delivery_charge}</span></p>
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
                                    const refundableTotal = (order.items || []).reduce((sum: number, item: any) => {
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
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Razorpay Metadata</p>
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

                                    {/* 2. Tax Invoice */}
                                    {(order.invoice_url || order.invoices?.find(i => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type))) && (
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
                                            <FileText className="mr-1.5 h-3 w-3" /> Download GST Invoice
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* NEW: Refund Information Section */}
                            {order.refunds && order.refunds.length > 0 && (
                                <div className="col-span-2 pt-0 mt-4">
                                    <div className="bg-red-50 border border-red-100 rounded-md p-3">
                                        <p className="text-[10px] text-red-800 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
                                            <RotateCcw className="h-3 w-3" />
                                            Refund Details
                                        </p>
                                        <div className="space-y-3">
                                            {order.refunds.map((refund: any, idx: number) => (
                                                <div key={idx} className="grid grid-cols-2 gap-4 text-xs border-b border-red-100 last:border-0 pb-2 last:pb-0">
                                                    <div>
                                                        <p className="text-red-700/70 mb-0.5">Processing ID (Razorpay)</p>
                                                        <code className="bg-white px-1.5 py-0.5 border border-red-200 rounded text-[10px] break-all text-red-800 font-mono">
                                                            {refund.razorpay_refund_id || refund.id}
                                                        </code>
                                                    </div>
                                                    <div>
                                                        <p className="text-red-700/70 mb-0.5">Refunded Amount</p>
                                                        <p className="font-bold text-red-700 text-sm">₹{refund.amount}</p>
                                                    </div>
                                                    {refund.notes && (
                                                        <div className="col-span-2 text-[10px] text-red-600 italic bg-white/50 p-1.5 rounded">
                                                            Note: {refund.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                        } as any);
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
                    {order.email_logs && order.email_logs.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="h-5 w-5" />
                                    Email Notifications
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {order.email_logs.map((email, index) => (
                                        <div key={index} className="flex gap-4 items-start border-l-2 border-muted pl-4 ml-2 pb-4 last:pb-0">
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm">{email.event_type.replace(/_/g, ' ')}</span>
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
                                                        {format(new Date(email.created_at), "MMM d, h:mm a")}
                                                    </p>
                                                </div>
                                                {email.status === 'FAILED' && (
                                                    <p className="text-xs text-red-600 mt-1">
                                                        Error: {email.error_message || 'Unknown error'} (Retries: {email.retry_count})
                                                    </p>
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
                            // If we have a legacy mismatch (Total != ComponentSum), 
                            // we pass the reconciled total taxable to the component.
                            const storedSum = (order.total_taxable_amount || 0) + (order.total_cgst || 0) + (order.total_sgst || 0) + (order.total_igst || 0);
                            const totalAmount = order.total_amount || 0;
                            const isLegacyMismatch = Math.abs(totalAmount - storedSum) > 1.0;
                            return isLegacyMismatch ? (order.total_taxable_amount || 0) + (order.delivery_charge || 0) : (order.total_taxable_amount || 0);
                        })()}
                        totalCgst={order.total_cgst}
                        totalSgst={order.total_sgst}
                        totalIgst={order.total_igst}
                        totalAmount={order.total_amount}
                        showInvoiceLink={order.status === 'delivered' || !!order.invoice_url}
                        invoiceUrl={order.invoice_url}
                        items={order.items}
                        deliveryCharge={order.delivery_charge || 0}
                        deliveryGST={order.delivery_gst || 0}
                        role="admin"
                    />

                    {order.payment_status === 'paid' && (
                        <Card>
                            <CardContent className="pt-6">
                                <RegenerateInvoiceButton
                                    orderId={order.id}
                                    onSuccess={fetchOrderDetail}
                                    className="w-full"
                                />
                            </CardContent>
                        </Card>
                    )}
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
