import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, FileText, ShoppingCart, Users, Heart, Shield, Activity, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { analyticsService, DashboardStats } from '@/services/analytics.service';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { DashboardAlerts } from '@/components/admin/DashboardAlerts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingOverlay, LoadingOverlayRelative } from "@/components/ui/loading-overlay";
import { Order } from '@/types';


export default function AdminDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [ordersPage, setOrdersPage] = useState(1);
  const ordersLimit = 10;

  // Dashboard Stats Query (Independent of orders page)
  const { data: dashboardData, isLoading: isStatsLoading, isFetching: isStatsFetching, error: statsError } = useQuery<DashboardStats>({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => analyticsService.getDashboardStats({ ordersLimit: 0 }), // Fetch stats without heavy orders list if possible, or just ignore list
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    placeholderData: keepPreviousData,
  });

  // Recent Orders Query (Paginated, Independent)
  const { data: ordersData, isLoading: isOrdersLoading, isFetching: isOrdersFetching } = useQuery({
    queryKey: ['admin-dashboard-recent-orders', ordersPage],
    queryFn: async () => {
      const { orderService } = await import("@/services/order.service");
      return orderService.getAll({
        page: ordersPage,
        limit: ordersLimit,
        all: 'true' // Request all orders as admin
      });
    },
    placeholderData: keepPreviousData,
  });

  // Real-time notifications
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        toast.info(`New Order #${payload.new.order_number} received!`, {
          duration: 60000,
          icon: <ShoppingCart className="h-4 w-4" />
        });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-recent-orders'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'donations' }, (payload) => {
        toast.info(`New Donation of ₹${payload.new.amount} received!`, {
          duration: 60000,
          icon: <Heart className="h-4 w-4 text-red-500" />
        });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_registrations' }, () => {
        toast.info(`New Event Registration!`, {
          duration: 60000,
          icon: <Calendar className="h-4 w-4" />
        });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'returns' }, (payload) => {
        // Only notify on initial request
        if (payload.new.status === 'requested') {
          toast.info(`New Return Request Received!`, {
            duration: 60000,
            icon: <RotateCcw className="h-4 w-4 text-orange-500" />,
            action: {
              label: "View Orders",
              onClick: () => navigate("/admin/orders?status=return_requested")
            }
          });
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, navigate]);

  if (statsError) {
    return (
      <div className="p-8 text-center text-red-500">
        <h3 className="text-lg font-bold">Failed to load dashboard data</h3>
        <p className="text-sm opacity-80 mb-4">{statsError.message}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] })}>
          Retry
        </Button>
      </div>
    );
  }

  const stats = dashboardData?.stats;
  const productCategories = dashboardData?.productCategories;
  // Use orders from the separate query
  const recentOrders = ordersData?.data || [];
  const ordersPagination = ordersData?.meta;

  const upcomingEvents = dashboardData?.upcomingEvents;
  const ongoingEvents = dashboardData?.ongoingEvents;

  const dashboardStats = [
    {
      title: 'Active Events',
      value: stats?.activeEvents?.toString() || '0',
      icon: Calendar,
      trend: '+0', // Placeholder
      trendUp: true,
    },
    {
      title: 'Ongoing Events',
      value: ongoingEvents?.length.toString() || '0',
      icon: Activity,
      trend: 'Now',
      trendUp: true,
    },
    {
      title: 'Blog Posts',
      value: stats?.blogPosts?.toString() || '0',
      icon: FileText,
      trend: 'All',
      trendUp: true,
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders?.toString() || '0',
      icon: ShoppingCart,
      trend: stats?.newOrdersCount ? `+${stats.newOrdersCount} this week` : 'No new orders',
      trendUp: (stats?.newOrdersCount || 0) > 0,
    },
    {
      title: 'Pending Returns',
      value: stats?.pendingReturns?.toString() || '0',
      icon: RotateCcw,
      trend: (stats?.pendingReturns || 0) > 0 ? `${stats?.pendingReturns} awaiting action` : 'All caught up!',
      trendUp: false, // More is usually not better in this context
      onClick: () => navigate("/admin/orders?status=active_returns")
    },
  ];

  // Add Admin-only cards
  if (user?.role === 'admin') {
    dashboardStats.push(
      {
        title: 'Total Managers',
        value: stats?.totalManagers?.toString() || '0',
        icon: Shield,
        trend: 'Admins Only',
        trendUp: true
      },
      {
        title: 'Total Customers',
        value: stats?.totalCustomers?.toString() || '0',
        icon: Users,
        trend: stats?.newCustomersCount ? `+${stats.newCustomersCount} this week` : 'No new customers',
        trendUp: (stats?.newCustomersCount || 0) > 0,
      },
      {
        title: 'Total Donations',
        value: '₹' + (stats?.totalDonations?.toLocaleString() || '0'),
        icon: Heart,
        trend: stats?.newDonationsAmount ? `+₹${stats.newDonationsAmount.toLocaleString()} this week` : 'No new donations',
        trendUp: (stats?.newDonationsAmount || 0) > 0,
      }
    );
  }

  if (isStatsLoading) {
    return <LoadingOverlay isLoading={true} message="Loading dashboard data..." />;
  }

  return (
    <div className="space-y-8 relative">
      {/* Background Sync Indicator */}
      {(isStatsFetching || isOrdersFetching) && !isStatsLoading && (
        <div className="absolute top-0 right-0 z-50 p-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-[#B85C3C]/20 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-[#B85C3C] rounded-full animate-pulse" />
            <span className="text-[10px] font-medium text-[#B85C3C] uppercase tracking-wider">Syncing</span>
          </div>
        </div>
      )}

      {/* Header with gradient accent */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#B85C3C]/5 via-transparent to-[#2C1810]/5 rounded-2xl -z-10" />
        <div className="py-2">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#2C1810] to-[#B85C3C] bg-clip-text text-transparent">
            Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Overview of your cow welfare platform</p>
        </div>
      </div>

      {/* Persistent Alerts */}
      <DashboardAlerts />

      {/* Stats Grid with enhanced cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dashboardStats.map((stat, index) => (
          <Card
            key={stat.title}
            className={`group relative overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${stat.onClick ? "cursor-pointer" : ""}`}
            onClick={stat.onClick}
          >
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-[#FDFBF7] opacity-100" />
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#B85C3C]/5 to-transparent rounded-bl-full" />

            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#2C1810]/80">{stat.title}</CardTitle>
              <div className={`p-2 rounded-xl transition-all duration-300 group-hover:scale-110 ${stat.title === 'Total Donations' ? 'bg-red-50 text-red-500' :
                stat.title === 'Ongoing Events' ? 'bg-green-50 text-green-500' :
                  'bg-[#FDFBF7] text-[#B85C3C]'
                }`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-[#2C1810]">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${stat.trendUp ? 'bg-green-500' : 'bg-muted-foreground'
                  }`} />
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events & Categories Row - Above Recent Orders */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Ongoing Events */}
        <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-white to-white" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-400" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-[#2C1810]">
              <div className="relative">
                <div className="absolute inset-0 bg-green-400 rounded-xl animate-ping opacity-20" />
                <div className="relative p-2 rounded-xl bg-green-100">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <span>Ongoing Events</span>
              {ongoingEvents && ongoingEvents.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                  {ongoingEvents.length} Live
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {ongoingEvents && ongoingEvents.length > 0 ? (
                ongoingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-green-100 hover:border-green-200 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1810] truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ends: {format(new Date(event.endDate), 'PPP')}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-semibold text-green-600">{event.registeredCount}</p>
                      <p className="text-xs text-muted-foreground">Registered</p>
                      {event.cancelledCount > 0 && (
                        <p className="text-xs text-red-500 mt-1">-{event.cancelledCount}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No ongoing events</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-[#B85C3C]/5 via-white to-white" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#B85C3C] to-[#D4846A]" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-[#2C1810]">
              <div className="p-2 rounded-xl bg-[#FDFBF7]">
                <Calendar className="h-5 w-5 text-[#B85C3C]" />
              </div>
              <span>Upcoming Events</span>
              {upcomingEvents && upcomingEvents.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-[#FDFBF7] text-[#B85C3C]">
                  {upcomingEvents.length} Scheduled
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {upcomingEvents && upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#B85C3C]/10 hover:border-[#B85C3C]/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1810] truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(event.date), 'PPP')}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-semibold text-[#B85C3C]">{event.registeredCount}</p>
                      <p className="text-xs text-muted-foreground">Registered</p>
                      {event.cancelledCount > 0 && (
                        <p className="text-xs text-red-500 mt-1">-{event.cancelledCount}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming events</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-white to-white" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-[#2C1810]">
              <div className="p-2 rounded-xl bg-amber-50">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <span>Top Categories</span>
              {productCategories && productCategories.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                  {productCategories.length} Total
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {productCategories && productCategories.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {productCategories.slice(0, 5).map((cat, index) => (
                  <div
                    key={cat.category}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-amber-100 hover:border-amber-200 transition-colors"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C1810] text-sm truncate">{cat.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-semibold text-amber-600">{cat.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">items</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No products yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders - Full Width Below */}
      <Card className="relative overflow-hidden border-none shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-[#FDFBF7]" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2C1810] via-[#B85C3C] to-[#D4846A]" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-3 text-[#2C1810]">
            <div className="p-2 rounded-xl bg-[#FDFBF7]">
              <ShoppingCart className="h-5 w-5 text-[#B85C3C]" />
            </div>
            <span>Recent Orders</span>
            {ordersPagination && ordersPagination.total > 0 && (
              <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-[#FDFBF7] text-[#B85C3C]">
                {ordersPagination.total} Total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {/* Table Loading Overlay - Only on pagination/search (placeholder data) */}
          {(isOrdersFetching && !isOrdersLoading) && (
            <LoadingOverlayRelative isLoading={true} message="Updating orders..." className="z-10 bg-white/40 backdrop-blur-[1px]" />
          )}

          {isOrdersLoading ? (
            <div className="h-48 flex items-center justify-center">
              <LoadingOverlayRelative isLoading={true} message="Loading orders..." />
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-[#FDFBF7]">
                  <TableRow className="hover:bg-transparent border-b-border/50">
                    <TableHead className="w-[120px] font-bold text-[#2C1810]">Order #</TableHead>
                    <TableHead className="font-bold text-[#2C1810]">Customer</TableHead>
                    <TableHead className="hidden sm:table-cell font-bold text-[#2C1810]">Date</TableHead>
                    <TableHead className="font-bold text-[#2C1810]">Status</TableHead>
                    <TableHead className="text-right font-bold text-[#2C1810]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders && recentOrders.length > 0 ? (
                    recentOrders.map((order: Order) => (
                      <TableRow key={order.id} className="hover:bg-[#FDFBF7]/50 transition-colors border-b-border/50">
                        <TableCell className="font-medium text-[#2C1810]">
                          #{order.order_number || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#2C1810]">{order.customer_name || 'Guest'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span>{order.created_at ? format(new Date(order.created_at as string), 'MMM d, yyyy') : 'N/A'}</span>
                            <span>{order.created_at ? format(new Date(order.created_at as string), 'h:mm a') : ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`capitalize text-[10px] font-bold px-2 py-0 h-5 border-none ${order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''
                              }`}
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-[#2C1810]">
                          ₹{order.total_amount || order.total}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                          <p className="text-muted-foreground">No orders found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {ordersPagination && ordersPagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((ordersPage - 1) * ordersLimit) + 1}-{Math.min(ordersPage * ordersLimit, ordersPagination.total)} of {ordersPagination.total} orders
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                  disabled={ordersPage === 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm font-medium px-3">
                  Page {ordersPage} of {ordersPagination.pages || ordersPagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrdersPage(p => Math.min(ordersPagination.pages || ordersPagination.pages, p + 1))}
                  disabled={ordersPage === (ordersPagination.pages || ordersPagination.pages)}
                  className="h-8 px-3"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
