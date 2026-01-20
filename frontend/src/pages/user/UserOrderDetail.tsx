import { logger } from "@/lib/logger";
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Package, CreditCard, Clock, CheckCircle, AlertTriangle, XCircle, RotateCcw, FileText, CheckSquare, Truck } from "lucide-react";
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
import { TaxBreakdown } from "@/components/orders/TaxBreakdown";
import { InvoiceActions } from "@/components/orders/InvoiceActions";
import { supabase } from "@/lib/supabase";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface OrderResponse {
    id: string;
    order_number?: string;
    created_at: string;
    status: string;
    user_id: string;
    invoice_id?: string;
    invoice_url?: string;
    invoices?: Array<{
        id: string;
        type: 'RAZORPAY' | 'TAX_INVOICE' | 'BILL_OF_SUPPLY';
        public_url?: string;
        invoice_number: string;
    }>;
    subtotal?: number;
    total_amount: number;
    delivery_charge?: number;
    delivery_gst?: number;
    coupon_discount?: number; // Added
    shipping_address?: Address & { full_name?: string; address_line1?: string; address_line2?: string; postal_code?: string; phone?: string; };
    billing_address?: Address & { full_name?: string; address_line1?: string; address_line2?: string; postal_code?: string; phone?: string; };
    payment_status?: string;
    payment_method?: string;
    payment_id?: string;
    // GST Tax fields
    total_taxable_amount?: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    items: Array<{
        id: string;
        quantity: number;
        price_per_unit?: number;
        remaining_quantity?: number;
        product?: Product;
        title?: string;
        price?: number;
        variant_id?: string;
        variant?: {
            id: string;
            size_label: string;
            size_value: number;
            unit: string;
            variant_image_url?: string;
        };
        size_label?: string;
        // Delivery snapshots
        delivery_charge?: number;
        delivery_gst?: number;
        delivery_calculation_snapshot?: {
            source?: string;
            delivery_refund_policy?: 'REFUNDABLE' | 'NON_REFUNDABLE';
        };
        gst_rate?: number;
    }>;
    order_status_history?: Array<{
        status: string;
        event_type?: string;
        actor?: string;
        created_at: string;
        notes?: string;
        updater?: { role_data?: { name: string } };
    }>;
    refunds?: Array<{
        id: string;
        razorpay_refund_id: string;
        amount: number;
        status: string;
        created_at: string;
    }>;
}

interface ReturnRequest {
    id: string;
    status: 'requested' | 'approved' | 'pickup_scheduled' | 'picked_up' | 'item_returned' | 'rejected' | 'cancelled' | 'completed';
    refund_amount: number;
    reason: string;
    created_at: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refund_breakdown?: any;
    return_items: Array<{
        quantity: number;
        reason: string;
        order_item_id: string;
        order_items: {
            title: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            variant_snapshot?: any;
        }
    }>;
}

interface ReturnableItem {
    id: string;
    title: string;
    price_per_unit: number;
    remaining_quantity: number;
    return_days?: number;
    return_deadline?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    variant_snapshot?: any;
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
    // Enhanced Return State
    const [itemReasons, setItemReasons] = useState<Record<string, string>>({});
    const [itemImages, setItemImages] = useState<Record<string, File[]>>({});
    const [itemConditions, setItemConditions] = useState<Record<string, string>>({});
    const [returns, setReturns] = useState<ReturnRequest[]>([]);

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

    const fetchReturns = useCallback(async () => {
        try {
            const response = await apiClient.get(`/returns/orders/${id}/all`);
            setReturns(response.data);
        } catch (error) {
            logger.error("Error fetching returns:", error);
        }
    }, [id]);

    const fetchOrderDetail = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/orders/${id}`);
            setOrder(response.data);
            fetchReturns(); // Fetch returns together
            fetchReturnableItems(); // Fetch items available for return
        } catch (error) {
            logger.error("Error fetching order:", error);
            // toast.error("Failed to load order details");
            navigate("/my-orders");
        } finally {
            setLoading(false);
        }
    }, [id, navigate, fetchReturns]);

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
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to cancel order"));
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
        }
    };

    const handleImageChange = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);

            setItemImages(prev => {
                const currentFiles = prev[itemId] || [];
                const totalFiles = [...currentFiles, ...newFiles];

                if (totalFiles.length > 3) {
                    toast.error("Maximum 3 images allowed per item");
                    return prev;
                }

                // Validate size (5MB limit)
                const invalidFile = newFiles.find(f => f.size > 5 * 1024 * 1024);
                if (invalidFile) {
                    toast.error(`File ${invalidFile.name} exceeds 5MB limit`);
                    return prev;
                }

                return { ...prev, [itemId]: totalFiles };
            });
        }
    };

    const removeImage = (itemId: string, index: number) => {
        setItemImages(prev => {
            const currentFiles = prev[itemId] || [];
            const newFiles = currentFiles.filter((_, i) => i !== index);
            return { ...prev, [itemId]: newFiles };
        });
    };

    const handleReturnOrder = async () => {
        try {
            if (selectedReturnItems.length === 0) {
                toast.error("Please select at least one item to return");
                return;
            }

            // Validation
            for (const item of selectedReturnItems) {
                const reason = itemReasons[item.id];
                const images = itemImages[item.id];

                if (!reason || !reason.trim()) {
                    toast.error("Please provide a return reason for all selected items");
                    return;
                }
                if (!images || images.length < 1) {
                    toast.error("Please upload at least 1 image for each selected item");
                    return;
                }
            }

            setLoadingMessage("Uploading images and submitting request...");
            setActionLoading(true);
            setReturnOpen(false);

            const uploadedPaths: string[] = [];

            // 1. Upload Images
            const itemsWithMetadata = await Promise.all(selectedReturnItems.map(async (item) => {
                const images = itemImages[item.id] || [];
                const imageUrls: string[] = [];

                for (const file of images) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${order?.user_id || 'guest'}/${id}/${item.id}/${Math.random().toString(36).substring(7)}.${fileExt}`;
                    const path = `returns/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('return_images')
                        .upload(path, file);

                    if (uploadError) {
                        console.error('Upload error:', uploadError);
                        throw new Error(`Failed to upload image for item`);
                    }

                    uploadedPaths.push(path);

                    const { data: { publicUrl } } = supabase.storage
                        .from('return_images')
                        .getPublicUrl(path);

                    imageUrls.push(publicUrl);
                }

                return {
                    orderItemId: item.id,
                    quantity: item.quantity,
                    reason: itemReasons[item.id],
                    images: imageUrls,
                    condition: itemConditions[item.id] || 'opened'
                };
            }));

            // 2. Submit Request
            try {
                await apiClient.post(`/returns/request`, {
                    orderId: id,
                    items: itemsWithMetadata,
                    reason: returnReason // Keeping global reason optional or as summary
                });

                toast.success("Return request submitted successfully");
                setReturnOpen(false);
                // Reset state
                setItemImages({});
                setItemReasons({});
                setSelectedReturnItems([]);

                fetchOrderDetail();
            } catch (apiError) {
                // CLEANUP: If API fails, delete uploaded images to avoid orphaned files
                if (uploadedPaths.length > 0) {
                    console.log('Cleaning up uploaded images due to API failure...', uploadedPaths);
                    await supabase.storage
                        .from('return_images')
                        .remove(uploadedPaths);
                }
                throw apiError;
            }
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

    const handleCancelReturn = async (returnId: string) => {
        try {
            setLoadingMessage("Cancelling return request...");
            setActionLoading(true);
            await apiClient.post(`/returns/${returnId}/cancel`);
            toast.success("Return request cancelled");
            fetchOrderDetail(); // Refresh everything
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to cancel return"));
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
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
    // 2. There are actual items available to return (fetched from backend)
    const canReturn = (() => {
        if (!['delivered', 'return_rejected', 'return_requested', 'return_approved'].includes(order.status)) return false;

        // If we have returnable items fetched, use that as the source of truth
        return returnableItems.length > 0;
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
                                {order.created_at ? format(new Date(order.created_at), "PPP") : "N/A"}
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
                    <div className="ml-auto flex items-center gap-2">

                        {/* Dual Invoice Download Buttons */}
                        {/* 1. Payment Receipt (Razorpay) */}
                        {order.invoices?.find(i => i.type === 'RAZORPAY')?.public_url && (
                            <Button variant="secondary" size="sm" onClick={() => window.open(order.invoices?.find(i => i.type === 'RAZORPAY')?.public_url, '_blank')}>
                                <FileText className="mr-2 h-4 w-4" /> Receipt
                            </Button>
                        )}

                        {/* 2. Tax Invoice (Internal) - Only show for DELIVERED orders */}
                        {order.status === 'delivered' && (order.invoice_url || order.invoices?.find(i => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type))) && (
                            <Button variant="outline" size="sm" onClick={() => {
                                // Prefer strict internal endpoint if available via order.invoice_url (set by orchestration)
                                // or fallback to constructing it if we have the ID from invoices array
                                const internalInv = order.invoices?.find(i => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type));
                                let url = null;

                                // 1. Priority: Trust the orchestrator-provided URL (handles strategy)
                                if (order.invoice_url && !order.invoice_url.includes('razorpay')) {
                                    url = order.invoice_url;
                                }
                                // 2. Fallback: Use invoices table entry (check public_url first for strategy compliance)
                                else if (internalInv) {
                                    url = internalInv.public_url || `/api/invoices/${internalInv.id}/download`;
                                }
                                if (url) {
                                    // If it's a relative API path, prepend backend URL manually if needed, 
                                    // or if order.invoice_url is already full URL (it was setting relative in Orchestrator)
                                    // Orchestrator sets: /api/invoices/:id/download
                                    // So we need to ensure we open full URL.
                                    const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${url}`;

                                    // For authenticated download, we might need a fetch or window.open might fail if auth cookie is strict?
                                    // Usually window.open works if cookies are SameSite=Lax/None. 
                                    // If using Bearer token, we need a helper. 
                                    // For now assuming Cookie auth or query param token (not impl). 
                                    // Let's try direct open first as our auth uses cookies.
                                    window.open(fullUrl, '_blank');
                                }
                            }}>
                                <FileText className="mr-2 h-4 w-4" /> Invoice
                            </Button>
                        )}

                        {/* Cancel Dialog */}
                        {canCancel && (
                            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
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
                                        size="sm"
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
                                                                    <p className="text-sm font-medium">
                                                                        {item.title}
                                                                        {item.variant_snapshot?.size_label && (
                                                                            <span className="text-muted-foreground font-normal ml-1">
                                                                                ({item.variant_snapshot.size_label})
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                                                        <span className="text-xs text-muted-foreground">₹{item.price_per_unit}</span>
                                                                        <span className="text-xs text-muted-foreground">•</span>
                                                                        <span className="text-xs text-muted-foreground">Max: {item.remaining_quantity}</span>
                                                                        {item.return_deadline && (
                                                                            <>
                                                                                <span className="text-xs text-muted-foreground">•</span>
                                                                                <span className="text-xs text-orange-600">
                                                                                    Return by: {format(new Date(item.return_deadline), "MMM d")}
                                                                                </span>
                                                                            </>
                                                                        )}
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



                                        {/* Dynamic Sections for Selected Items */}
                                        {selectedReturnItems.length > 0 && (
                                            <div className="space-y-4 border-t pt-4">
                                                <Label className="text-sm font-semibold">Item Details & Condition</Label>
                                                {selectedReturnItems.map(selectedItem => {
                                                    const itemDef = returnableItems.find(i => i.id === selectedItem.id);
                                                    if (!itemDef) return null;

                                                    return (
                                                        <div key={selectedItem.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                                                            <div className="font-medium text-sm flex justify-between">
                                                                <span>{itemDef.title}</span>
                                                                <Badge variant="outline">Qty: {selectedItem.quantity}</Badge>
                                                            </div>

                                                            {/* Reason */}
                                                            <div>
                                                                <Label className="text-xs text-muted-foreground mb-1 block">Reason for Return *</Label>
                                                                <Textarea
                                                                    placeholder="Why are you returning this?"
                                                                    value={itemReasons[selectedItem.id] || ''}
                                                                    onChange={e => setItemReasons(prev => ({ ...prev, [selectedItem.id]: e.target.value }))}
                                                                    className="text-sm min-h-[60px] resize-none bg-white"
                                                                />
                                                            </div>

                                                            {/* Images */}
                                                            <div>
                                                                <Label className="text-xs text-muted-foreground mb-1 block">
                                                                    Upload Images (Min 1, Max 3) *
                                                                </Label>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {(itemImages[selectedItem.id] || []).map((file, idx) => (
                                                                        <div key={idx} className="relative w-16 h-16 border rounded bg-white overflow-hidden group">
                                                                            <img
                                                                                src={URL.createObjectURL(file)}
                                                                                className="w-full h-full object-cover"
                                                                                alt="preview"
                                                                            />
                                                                            <button
                                                                                onClick={() => removeImage(selectedItem.id, idx)}
                                                                                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {(itemImages[selectedItem.id]?.length || 0) < 3 && (
                                                                        <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                                                                            <Upload className="h-4 w-4 text-gray-400" />
                                                                            <span className="text-[9px] text-gray-500 mt-1">Add</span>
                                                                            <input
                                                                                type="file"
                                                                                accept="image/*"
                                                                                className="hidden"
                                                                                onChange={(e) => handleImageChange(selectedItem.id, e)}
                                                                            />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Global Reason Input (Optional/Summary) */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold">Additional Comments (Optional)</Label>
                                            <Textarea
                                                placeholder="Any other feedback about this order?"
                                                value={returnReason}
                                                onChange={e => setReturnReason(e.target.value)}
                                                className="min-h-[60px] resize-none"
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
                                            disabled={actionLoading || selectedReturnItems.length === 0}
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
                </div >

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
                                    {(() => {
                                        // Calculate Non-Refundable Total to Bundle
                                        const refundableTotal = (order.items || []).reduce((sum: number, item) => {
                                            const snapshot = item.delivery_calculation_snapshot || {};
                                            if (snapshot.source !== 'global' && snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                                return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                            }
                                            return sum;
                                        }, 0);

                                        const deliveryTotal = (order.delivery_charge || 0) + (order.delivery_gst || 0);
                                        const nonRefundableTotalToBundle = Math.max(0, deliveryTotal - refundableTotal);

                                        // Total for pro-rating
                                        const itemsTotalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price_per_unit || item.product?.price || 0)), 0);

                                        return order.items.map((item, index) => {
                                            // Get variant size label
                                            const sizeLabel = item.variant?.size_label || item.size_label;
                                            // Use variant image if available, otherwise use product image
                                            const displayImage = item.variant?.variant_image_url || item.product?.images?.[0];

                                            // Calculate Bundled Price
                                            const rawUnitPrice = item.price_per_unit || item.product?.price || 0;
                                            const itemTotalRaw = item.quantity * rawUnitPrice;

                                            // Bundling logic removed for clarity, showing raw inclusive prices
                                            const bundledUnitPrice = rawUnitPrice;

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
                                                    </div>
                                                    <div className="text-right font-medium">
                                                        ₹{(item.quantity * bundledUnitPrice).toFixed(2)}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                                <Separator className="my-4" />
                                <div className="space-y-2 text-sm">
                                    {(() => {
                                        const refundableTotal = (order.items || []).reduce((sum: number, item) => {
                                            const snapshot = item.delivery_calculation_snapshot || {};
                                            if (snapshot.source !== 'global' && snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                                return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                            }
                                            return sum;
                                        }, 0);

                                        const itemizedDeliveryGST = (order.items || []).reduce((sum, item) => sum + (Number(item.delivery_gst) || 0), 0);
                                        let effectiveDeliveryGST = Number(order.delivery_gst) || itemizedDeliveryGST;
                                        const subtotal = (order.items || []).reduce((sum: number, item) => sum + (item.quantity * (item.price_per_unit || item.product?.price || 0)), 0);

                                        // Fallback: If tax info is missing but total implies it exists (Total > Subtotal + Delivery)
                                        // This fixes display for legacy orders or where item.delivery_gst is stripped
                                        const deliveryBase = Number(order.delivery_charge) || 0;
                                        if (effectiveDeliveryGST === 0 && deliveryBase > 0) {
                                            const impliedTax = (order.total_amount || 0) + (order.coupon_discount || 0) - subtotal - deliveryBase;
                                            if (impliedTax > 0 && impliedTax < deliveryBase) { // Sanity check
                                                effectiveDeliveryGST = impliedTax;
                                            }
                                        }

                                        const deliveryTotal = deliveryBase + effectiveDeliveryGST;

                                        return (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Subtotal</span>
                                                    <span>₹{subtotal.toFixed(2)}</span>
                                                </div>
                                                {deliveryTotal > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                                            Delivery & Handling
                                                            {refundableTotal > 0 && (
                                                                <Badge variant="outline" className="text-[10px] h-4 font-normal text-blue-600 border-blue-200 bg-blue-50">Refundable</Badge>
                                                            )}
                                                        </span>
                                                        <span>₹{deliveryTotal.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {(order.coupon_discount ?? 0) > 0 && (
                                                    <div className="flex justify-between text-green-600 font-medium">
                                                        <span>Coupon Discount</span>
                                                        <span>-₹{(order.coupon_discount ?? 0).toFixed(2)}</span>
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

                        {/* Active/History Returns */}
                        {returns.length > 0 && (
                            <Card className="border-orange-100 shadow-sm overflow-hidden">
                                <CardHeader className="bg-orange-50/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-lg text-orange-950">
                                            <RotateCcw className="h-5 w-5 text-orange-600" /> Return Requests
                                        </CardTitle>
                                        <Badge variant="outline" className="bg-white border-orange-200 text-orange-800">
                                            {returns.length} Request{returns.length > 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-orange-800/70">
                                        Track the status of your return and refund requests.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-orange-100">
                                        {returns.map((ret) => (
                                            <div key={ret.id} className="p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant={
                                                            ret.status === 'approved' ? 'default' :
                                                                ['picked_up', 'pickup_scheduled', 'item_returned'].includes(ret.status) ? 'outline' :
                                                                    ret.status === 'rejected' ? 'destructive' : 'secondary'
                                                        } className={`capitalize ${ret.status === 'approved' ? 'bg-green-600 text-white' :
                                                            ['picked_up', 'pickup_scheduled'].includes(ret.status) ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                                                ret.status === 'item_returned' ? 'bg-green-50 text-green-700 border-green-200' : ''}`}>
                                                            {ret.status.replace('_', ' ')}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            Requested on {format(new Date(ret.created_at), "MMM d, yyyy")}
                                                        </span>
                                                    </div>
                                                    {ret.status === 'requested' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                                                            onClick={() => handleCancelReturn(ret.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            Cancel Request
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Informational Message about the new workflow */}
                                                {ret.status === 'approved' && (
                                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
                                                        <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                                                        <p>
                                                            <strong>Next Step:</strong> Our courier partner will contact you shortly to schedule the pickup.
                                                            Your refund will be initiated once the items reach our warehouse and are verified.
                                                        </p>
                                                    </div>
                                                )}
                                                {ret.status === 'picked_up' && (
                                                    <div className="bg-indigo-50 border border-indigo-100 rounded-md p-3 text-xs text-indigo-800 flex items-start gap-2">
                                                        <Truck className="h-4 w-4 mt-0.5 shrink-0" />
                                                        <p>
                                                            <strong>Item Picked Up:</strong> Your return is on its way to our warehouse.
                                                            We will process your refund immediately upon receipt and verification of the items.
                                                        </p>
                                                    </div>
                                                )}
                                                {ret.status === 'item_returned' && (
                                                    <div className="bg-green-50 border border-green-100 rounded-md p-3 text-xs text-green-800 flex items-start gap-2">
                                                        <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                        <p>
                                                            <strong>Returned & Verified:</strong> We have received your returned items.
                                                            Your refund has been initiated and should reflect in your account within 5-7 business days.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="space-y-2 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                                    {ret.return_items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-xs items-center">
                                                            <span className="text-gray-600 flex items-center gap-2">
                                                                <span className="w-4 h-4 rounded bg-gray-200 flex items-center justify-center text-[10px] font-bold">{item.quantity}</span>
                                                                {item.order_items.title}
                                                                {item.order_items.variant_snapshot?.size_label && (
                                                                    <span className="text-muted-foreground">({item.order_items.variant_snapshot.size_label})</span>
                                                                )}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground italic max-w-[150px] truncate" title={item.reason}>
                                                                "{item.reason}"
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {(ret.status === 'approved' || ret.refund_amount > 0) && (
                                                        <div className="pt-2 mt-2 border-t border-dashed flex justify-between items-center">
                                                            <span className="text-[11px] font-semibold text-gray-700">Refundable Amount</span>
                                                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs py-0">
                                                                ₹{ret.refund_amount.toFixed(2)}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Order Timeline */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" /> Order Timeline
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative border-l border-muted ml-2 space-y-6 pb-2 mt-2">
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
                                                actor: 'SYSTEM'
                                            });
                                        }

                                        return historyItems
                                            .slice()
                                            .sort((a, b) => {
                                                const dateA = new Date(a.created_at).getTime();
                                                const dateB = new Date(b.created_at).getTime();
                                                return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
                                            })
                                            .map((history, index) => {
                                                let formattedDate = "Date N/A";
                                                try {
                                                    formattedDate = format(new Date(history.created_at), "PPP p");
                                                } catch (e) { formattedDate = "Invalid Date"; }

                                                return (
                                                    <div key={index} className="ml-6 relative">
                                                        <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background ring-2 ring-muted" />
                                                        <p className="font-medium text-sm capitalize flex items-center gap-2">
                                                            <span>{(history.event_type || history.status || 'Updated').replace(/_/g, ' ')}</span>
                                                            {(history.event_type === 'REFUND_COMPLETED' || history.event_type === 'REFUND_PARTIAL' || history.status === 'refunded' || history.status === 'partially_refunded') && order.refunds?.some(r => {
                                                                try {
                                                                    return Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime()) < 120000;
                                                                } catch { return false; }
                                                            }) && (
                                                                    <Badge variant="outline" className="text-[10px] h-5 font-normal border-green-200 bg-green-50 text-green-700">
                                                                        ₹{order.refunds.find(r => {
                                                                            try {
                                                                                return Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime()) < 120000;
                                                                            } catch { return false; }
                                                                        })?.amount}
                                                                    </Badge>
                                                                )}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mb-1">
                                                            {formattedDate}
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
                                                )
                                            });
                                    })()}
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
                                        <Badge variant={order.payment_status === 'paid' ? 'default' :
                                            (order.payment_status === 'refunded' || order.payment_status === 'partially_refunded') ? 'destructive' :
                                                order.payment_status === 'refund_initiated' ? 'outline' : 'secondary'}
                                            className="ml-2 uppercase">
                                            {order.payment_status === 'partially_refunded' ? 'Refunded' : order.payment_status?.replace(/_/g, ' ')}
                                        </Badge>
                                        {order.payment_status === 'refund_initiated' && (
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

                                    {/* Refund IDs */}
                                    {order.refunds && order.refunds.length > 0 && (
                                        <div className="pt-2 border-t mt-2">
                                            <span className="text-muted-foreground text-xs block mb-1">Refund Reference(s):</span>
                                            <div className="space-y-1">
                                                {order.refunds.map((r, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs bg-red-50 p-1 rounded border border-red-100">
                                                        <span className="font-mono text-red-800">{r.razorpay_refund_id || r.id}</span>
                                                        <span className="font-medium text-red-700">₹{r.amount}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tax Summary */}
                        {/* Tax Summary - Smart Handling for Legacy vs New Data */}
                        {(() => {
                            // Calculate stored tax sum logic
                            const storedTaxable = order.total_taxable_amount || 0;
                            const storedTax = (order.total_cgst || 0) + (order.total_sgst || 0) + (order.total_igst || 0);
                            const storedSum = storedTaxable + storedTax;

                            // Calculate expected total including delivery
                            const deliveryCharge = order.delivery_charge || 0;
                            const deliveryGST = order.delivery_gst || 0;
                            const totalAmount = order.total_amount || 0;

                            // Check mismatch (Legacy: storedSum ~= ProductTotal vs TotalAmount ~= ProductTotal + Delivery)
                            const isLegacyMismatch = Math.abs(totalAmount - storedSum) > 1.0;

                            // If mismatch, we inject delivery components to make visual math work
                            // This ensures: Taxable (Product + Delivery) + Tax (Product + Delivery) = Grand Total
                            const effectiveTaxable = isLegacyMismatch ? (storedTaxable + deliveryCharge) : storedTaxable;

                            // For tax breakdown, we need to distribute delivery GST appropriately
                            // We don't know exact interstate status here easily provided by backend, 
                            // but we can infer or distribute evenly for display if needed.
                            // Simply adding to existing buckets is safest visual approximation.
                            // If IGST > 0, assume interstate. Else intrastate.
                            const isInterstate = (order.total_igst || 0) > 0;

                            return (
                                <TaxBreakdown
                                    totalTaxableAmount={effectiveTaxable}
                                    totalCgst={order.total_cgst}
                                    totalSgst={order.total_sgst}
                                    totalIgst={order.total_igst}
                                    totalAmount={totalAmount}
                                    showInvoiceLink={order.status === 'delivered' && (!!order.invoice_url || !!order.invoices?.find(i => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type)))}
                                    invoiceUrl={(() => {
                                        const internalInv = order.invoices?.find(i => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type));
                                        let url = null;
                                        if (order.invoice_url && !order.invoice_url.includes('razorpay')) {
                                            url = order.invoice_url;
                                        } else if (internalInv) {
                                            url = internalInv.public_url || `/api/invoices/${internalInv.id}/download`;
                                        }
                                        if (!url) return undefined;
                                        return url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${url}`;
                                    })()}
                                    items={order.items}
                                    deliveryCharge={deliveryCharge}
                                    deliveryGST={deliveryGST}
                                    role="customer"
                                />
                            );
                        })()}
                    </div>
                </div>
            </div >
        </>
    );
}
