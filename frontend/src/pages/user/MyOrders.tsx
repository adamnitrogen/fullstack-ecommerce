import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, ShoppingBag, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { orderService } from "@/services/order.service";
import { Order } from "@/types";
import { logger } from "@/lib/logger";

export default function MyOrders() {
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);

    // Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 500);
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

    // Use Query for optimized fetching
    const { data, isLoading: loading, error } = useQuery({
        queryKey: ['my-orders', currentPage, debouncedSearch, statusFilter, paymentStatusFilter, dateRange],
        queryFn: async () => {
            const response = await orderService.getMyOrders({
                page: currentPage,
                limit: 12,
                orderNumber: debouncedSearch,
                status: statusFilter === "all" ? undefined : statusFilter,
                payment_status: paymentStatusFilter === "all" ? undefined : paymentStatusFilter,
                startDate: dateRange.start || undefined,
                endDate: dateRange.end || undefined
            });
            return response;
        },
        placeholderData: (previousData) => previousData, // Maintain UI during pagination
    });

    const orders = data?.data || [];
    const meta = data?.meta || { page: 1, limit: 12, total: 0, totalPages: 1 };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= meta.totalPages) {
            setCurrentPage(newPage);
        }
    };

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setPaymentStatusFilter("all");
        setDateRange({ start: "", end: "" });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "confirmed": return "bg-blue-100 text-blue-800 border-blue-200";
            case "processing": return "bg-yellow-100 text-yellow-800 border-yellow-200";
            case "packed": return "bg-indigo-100 text-indigo-800 border-indigo-200";
            case "shipped": return "bg-purple-100 text-purple-800 border-purple-200";
            case "delivered": return "bg-green-100 text-green-800 border-green-200";
            case "cancelled": return "bg-red-100 text-red-800 border-red-200";
            case "return_requested": return "bg-orange-100 text-orange-800 border-orange-200";
            case "returned": return "bg-gray-100 text-gray-800 border-gray-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
                    <p className="text-muted-foreground mt-1">Track and manage your recent orders</p>
                </div>
                <Button onClick={() => navigate("/shop")}>
                    Continue Shopping <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>

            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="order-search"
                        name="order-search"
                        placeholder="Search by Order #"
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Order Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="Payment Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Payments</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="refund_initiated">Refund Initiated</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex gap-2">
                    <Input
                        id="start-date"
                        name="start-date"
                        type="date"
                        value={dateRange.start}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="w-full"
                        placeholder="Start Date"
                    />
                </div>
                <div className="flex gap-2">
                    <Input
                        id="end-date"
                        name="end-date"
                        type="date"
                        value={dateRange.end}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="w-full"
                        placeholder="End Date"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center min-h-[40vh]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : orders.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold">No orders found</h3>
                            <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
                        </div>
                        <Button variant="outline" onClick={clearFilters} className="mt-4">
                            Clear Filters
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">
                                            {order.order_number || order.id.substring(0, 8).toUpperCase()}
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const dateStr = order.createdAt || order.created_at || "";
                                                const date = dateStr ? new Date(dateStr) : new Date();
                                                return !isNaN(date.getTime()) ? format(date, "MMM d, yyyy") : "N/A";
                                            })()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={getStatusColor(order.status)}>
                                                {order.status.replace(/_/g, " ").toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="uppercase text-xs font-normal">
                                                {order.paymentStatus || order.payment_status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ₹{(order.total || order.total_amount || 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/my-orders/${order.id}`)}
                                            >
                                                View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    {meta.totalPages > 1 && (
                        <div className="flex items-center justify-between border-t pt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {((meta.page - 1) * meta.limit) + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} orders
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(meta.page - 1)}
                                    disabled={meta.page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-2" />
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((pageNum) => (
                                        <Button
                                            key={pageNum}
                                            variant={pageNum === meta.page ? "default" : "ghost"}
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => handlePageChange(pageNum)}
                                        >
                                            {pageNum}
                                        </Button>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(meta.page + 1)}
                                    disabled={meta.page === meta.totalPages}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
