import { logger } from "@/lib/logger";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export default function OrdersManagement() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);

      const params: Record<string, unknown> = {
        page,
        limit: ITEMS_PER_PAGE,
        all: 'true'
      };

      if (searchTerm) params.orderNumber = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await apiClient.get("/orders", { params });
      const result = response.data;

      setOrders(result.data || []);

      // Calculate pagination from meta
      if (result.meta) {
        setTotalOrders(result.meta.total || 0);
        setTotalPages(result.meta.pages || 1);
      }
    } catch (error) {
      logger.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      // Whenever search or filter changes, we reset to page 1.
      setCurrentPage(1);
      // We don't fetch here directly to avoid race conditions with the page change effect,
      // but since setting page to 1 might not trigger the effect if it's already 1,
      // we need to ensure fetch happens.
      // Easiest is to call fetchOrders(1) here explicitly.
      fetchOrders(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, fetchOrders]);

  // Fetch on page change
  useEffect(() => {
    // Fetch only if page > 1, because page 1 is handled by the initial load and search debouncer.
    // However, initial load needs to happen.
    // Let's refine: The search debouncer runs on mount too (initial render with empty search).
    // So it will fetch page 1.
    // If we change page to 2, this effect runs.
    if (currentPage > 1) {
      fetchOrders(currentPage);
    }
  }, [currentPage, fetchOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "shipped":
        return "bg-purple-100 text-purple-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Orders Management</h1>
        <div className="text-sm text-muted-foreground">
          Total Orders: {totalOrders}
        </div>
      </div>

      <LoadingOverlay isLoading={loading} message="Loading orders..." />

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search order # or customer..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.order_number || `#${order.id.substring(0, 8).toUpperCase()}`}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const date = new Date(order.created_at);
                      return !isNaN(date.getTime())
                        ? format(date, "MMM d, yyyy")
                        : "Date N/A";
                    })()}
                  </TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-xs">
                      {order.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{(order.total_amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setCurrentPage(p => p - 1);
                }}
                className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }).map((_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={currentPage === i + 1}
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(i + 1);
                  }}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) setCurrentPage(p => p + 1);
                }}
                className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
