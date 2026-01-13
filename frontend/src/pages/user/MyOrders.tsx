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
import { Loader2, ArrowRight, ShoppingBag, Search, ChevronLeft, ChevronRight, Package, Filter, Calendar, CreditCard, Sparkles, ShoppingCart } from "lucide-react";
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
import { LoadingOverlay } from "@/components/ui/loading-overlay";

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
            case "confirmed": return "bg-blue-50 text-blue-700 border-blue-200/50";
            case "processing": return "bg-amber-50 text-amber-700 border-amber-200/50";
            case "packed": return "bg-indigo-50 text-indigo-700 border-indigo-200/50";
            case "shipped": return "bg-purple-50 text-purple-700 border-purple-200/50";
            case "delivered": return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
            case "cancelled": return "bg-rose-50 text-rose-700 border-rose-200/50";
            case "return_requested": return "bg-orange-50 text-orange-700 border-orange-200/50";
            case "returned": return "bg-slate-50 text-slate-700 border-slate-200/50";
            default: return "bg-slate-50 text-slate-700 border-slate-200/50";
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFBF9]">
            {/* Hero Section */}
            <div className="bg-[#2C1810] text-white py-16 md:py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30"></div>
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#B85C3C] rounded-full blur-[120px] opacity-20"></div>
                <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-[#B85C3C] rounded-full blur-[120px] opacity-10"></div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/20 border border-[#B85C3C]/30 text-[#B85C3C] text-xs font-bold uppercase tracking-widest animate-in fade-in slide-in-from-left duration-500">
                                <Sparkles className="h-3.5 w-3.5" /> Order History
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-playfair font-bold text-white leading-tight animate-in fade-in slide-in-from-left duration-700 delay-100">
                                My Sacred <span className="text-[#B85C3C]">Acquisitions</span>
                            </h1>
                            <nav className="flex items-center gap-2 text-sm text-white/60 animate-in fade-in slide-in-from-left duration-700 delay-200 font-medium tracking-wide">
                                <span>Home</span>
                                <ChevronRight className="h-3 w-3" />
                                <span className="text-white">Order History</span>
                            </nav>
                        </div>
                        <Button
                            onClick={() => navigate("/shop")}
                            className="w-full md:w-auto bg-[#B85C3C] hover:bg-white hover:text-[#2C1810] text-white font-bold text-xs uppercase tracking-widest px-8 h-12 rounded-full shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-right duration-700 delay-300"
                        >
                            Return to Shop <ShoppingCart className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-10 pb-20 relative z-20">
                {/* Filters Section */}
                <Card className="rounded-[2.5rem] border-none shadow-elevated overflow-hidden bg-white mb-8">
                    <div className="bg-muted/30 p-4 border-b border-border/40">
                        <div className="flex items-center gap-2 text-[#2C1810] px-2">
                            <Filter className="h-4 w-4 text-[#B85C3C]" />
                            <span className="text-xs font-bold uppercase tracking-widest">Refine Search</span>
                        </div>
                    </div>
                    <CardContent className="p-6 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="relative group col-span-1 md:col-span-2 lg:col-span-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[#B85C3C] transition-colors" />
                                <Input
                                    id="order-search"
                                    name="order-search"
                                    placeholder="Order #"
                                    className="pl-10 h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]"
                                    value={searchQuery}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-[#B85C3C]" />
                                        <SelectValue placeholder="Status" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-elevated">
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="shipped">Shipped</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="returned">Returned</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-[#B85C3C]" />
                                        <SelectValue placeholder="Payment" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-elevated">
                                    <SelectItem value="all">All Payments</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                    <SelectItem value="refunded">Refunded</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="relative">
                                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="start-date"
                                    name="start-date"
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="pl-10 h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C] text-xs"
                                />
                            </div>
                            <div className="relative">
                                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="end-date"
                                    name="end-date"
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="pl-10 h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C] text-xs"
                                />
                            </div>
                        </div>

                        {(searchQuery || statusFilter !== "all" || paymentStatusFilter !== "all" || dateRange.start || dateRange.end) && (
                            <div className="mt-6 pt-6 border-t border-dashed border-border/60 flex justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="text-muted-foreground hover:text-[#B85C3C] hover:bg-[#B85C3C]/5 font-bold text-[10px] uppercase tracking-widest px-4 h-9 rounded-full"
                                >
                                    Clear all filters
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <LoadingOverlay isLoading={loading} message="Summoning your order records..." />

                {orders.length === 0 && !loading ? (
                    <Card className="text-center py-24 bg-white rounded-[2.5rem] border-none shadow-elevated overflow-hidden">
                        <CardContent className="flex flex-col items-center gap-6">
                            <div className="h-24 w-24 bg-[#FDFBF9] rounded-full flex items-center justify-center shadow-soft border border-border/40">
                                <ShoppingBag className="h-10 w-10 text-[#B85C3C] opacity-40" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-playfair font-bold text-[#2C1810]">No Orders to Unveil</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mx-auto italic">
                                    Your acquisition log is currently a clean slate. Explore our collection and find something worthy of your sanctuary.
                                </p>
                            </div>
                            <Button
                                onClick={() => navigate("/shop")}
                                className="mt-4 bg-[#2C1810] hover:bg-[#B85C3C] text-white rounded-full font-bold text-xs uppercase tracking-widest px-10 h-12 shadow-lg transition-all"
                            >
                                Shop Our Collection
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <div className="rounded-[2rem] shadow-elevated overflow-hidden border-none bg-white">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-border/40 hover:bg-transparent">
                                        <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6 pl-8">Order Information</TableHead>
                                        <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6">Timeline</TableHead>
                                        <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6">Status</TableHead>
                                        <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6">Payment</TableHead>
                                        <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6 text-right">Investment</TableHead>
                                        <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6 text-right pr-8">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order) => (
                                        <TableRow key={order.id} className="border-border/40 hover:bg-[#FDFBF9]/50 transition-colors group">
                                            <TableCell className="py-6 pl-8">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-[#2C1810] group-hover:text-[#B85C3C] transition-colors">
                                                        #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Standard Acquisition</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <span className="text-sm font-medium text-muted-foreground">
                                                    {(() => {
                                                        const dateStr = order.createdAt || order.created_at || "";
                                                        const date = dateStr ? new Date(dateStr) : new Date();
                                                        return !isNaN(date.getTime()) ? format(date, "MMM d, yyyy") : "N/A";
                                                    })()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <Badge variant="outline" className={`rounded-full px-3 py-1 font-bold text-[10px] tracking-widest uppercase border-transparent shadow-sm ${getStatusColor(order.status)}`}>
                                                    {order.status.replace(/_/g, " ")}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant="secondary" className="rounded-full bg-[#2C1810]/5 text-[#2C1810] hover:bg-[#2C1810]/5 font-bold text-[10px] tracking-widest py-0.5 px-2 uppercase shadow-none border-none">
                                                        {order.paymentStatus || order.payment_status}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 text-right">
                                                <span className="text-sm font-bold text-[#2C1810]">
                                                    ₹{(order.total || order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-6 text-right pr-8">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => navigate(`/my-orders/${order.id}`)}
                                                    className="rounded-full hover:bg-[#B85C3C] hover:text-white font-bold text-[10px] uppercase tracking-widest h-9 px-4 transition-all"
                                                >
                                                    Unveil Details <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination Controls */}
                        {meta.totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white rounded-[2rem] p-6 shadow-soft border border-border/40">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Displaying {((meta.page - 1) * meta.limit) + 1} - {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} records
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(meta.page - 1)}
                                        disabled={meta.page === 1}
                                        className="rounded-full h-10 px-4 border-border/60 text-muted-foreground hover:text-[#2C1810] hover:bg-muted/50 transition-all font-bold text-[10px] uppercase tracking-widest disabled:opacity-30"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1.5" />
                                        Previous
                                    </Button>

                                    <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-full">
                                        {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                                            const pageNum = i + 1; // Simplistic pagination logic for now
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={pageNum === meta.page ? "default" : "ghost"}
                                                    size="sm"
                                                    className={`h-8 w-8 rounded-full p-0 font-bold text-[10px] ${pageNum === meta.page
                                                            ? "bg-[#B85C3C] text-white hover:bg-[#B85C3C] shadow-md shadow-[#B85C3C]/20"
                                                            : "text-muted-foreground hover:bg-[#B85C3C]/10 hover:text-[#B85C3C]"
                                                        }`}
                                                    onClick={() => handlePageChange(pageNum)}
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(meta.page + 1)}
                                        disabled={meta.page === meta.totalPages}
                                        className="rounded-full h-10 px-4 border-border/60 text-muted-foreground hover:text-[#2C1810] hover:bg-muted/50 transition-all font-bold text-[10px] uppercase tracking-widest disabled:opacity-30"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
