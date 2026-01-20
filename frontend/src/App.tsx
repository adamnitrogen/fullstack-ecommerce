import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { logRouteChange } from "@/lib/logger";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import { MainLayout } from "@/components/layout/MainLayout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { CookieConsent } from "@/components/CookieConsent";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { Skeleton } from "@/components/ui/skeleton";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ForceChangePasswordDialog } from "@/components/auth/ForceChangePasswordDialog";
import { ReactivationModal } from "@/components/auth/ReactivationModal";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { couponService } from "@/services/coupon.service";

import Index from "./pages/Index";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSummary from "./pages/OrderSummary";
import OrderConfirmation from "./pages/OrderConfirmation";
import Profile from "./pages/Profile";
import Gallery from "./pages/Gallery";
import Donate from "./pages/Donate";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import EventRegistration from "./pages/EventRegistration";
import Contact from "./pages/Contact";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ShippingAndRefund from "./pages/ShippingAndRefund";
import FAQ from "./pages/FAQ";
import AuthCallback from "./pages/AuthCallback";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import MyOrders from "./pages/user/MyOrders";
import UserOrderDetail from "./pages/user/UserOrderDetail";
import AccountDeletion from "./pages/AccountDeletion";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import ProductsManagement from "./pages/admin/ProductsManagement";
import AllCategoriesManagement from "./pages/admin/AllCategoriesManagement";
import EventsManagement from "./pages/admin/EventsManagement";
import BlogsManagement from "./pages/admin/BlogsManagement";
import GalleryManagement from "./pages/admin/GalleryManagement";
import CarouselManagement from "./pages/admin/CarouselManagement";
import UsersManagement from "./pages/admin/UsersManagement";
import ManagerManagement from "./pages/admin/ManagerManagement";
import ReviewsManagement from "./pages/admin/ReviewsManagement";
import FlaggedCommentsManagement from "./pages/admin/FlaggedCommentsManagement";
import FAQsManagement from "./pages/admin/FAQsManagement";
import ContactManagement from "./pages/admin/ContactManagement";
import ContactMessages from "./pages/admin/ContactMessages";
import ContactMessageDetail from "./pages/admin/ContactMessageDetail";
import AboutUsManagement from "./pages/admin/AboutUsManagement";
import PolicyManagement from "./pages/admin/PolicyManagement";
import JobsManagement from "./pages/admin/JobsManagement";
import OrdersManagement from "./pages/admin/OrdersManagementNew";
import OrderDetail from "./pages/admin/OrderDetail";
import SettingsManagement from "./pages/admin/SettingsManagement";

const queryClient = new QueryClient();

/**
 * Route tracker component for New Relic navigation analytics
 */
function RouteTracker() {
  const location = useLocation();
  const previousRoute = useRef<string | undefined>(undefined);

  useEffect(() => {
    logRouteChange(location.pathname, previousRoute.current);
    previousRoute.current = location.pathname;
  }, [location.pathname]);

  return null;
}

const App = () => {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    // skip initialization on auth callback route to avoid race condition with AuthCallback component
    if (window.location.pathname === '/auth/callback') {
      return;
    }

    // Restore session from JWT cookie on mount
    initializeAuth();

    // Initialize location data (countries & states)
    useLocationStore.getState().initializeStore();

    // Coupon Management: Fetch active coupons and cache in session storage
    const fetchCoupons = async () => {
      try {
        // Only fetch if not already cached to avoid redundant calls on page refresh
        // But the requirement says "fetch the coupon for every session starts", which mount effectively is.
        // We will fetch regardless to ensure fresh data on app load.
        const coupons = await couponService.getActive();
        sessionStorage.setItem('active_coupons', JSON.stringify(coupons));
        // console.debug('[App] Coupons fetched and cached:', coupons.length); // keep logs clean
      } catch (error) {
        // Gracefully handle error - log it but don't crash app
        // Using console.error/warn here might be too noisy if it's just a network blip
        // But better to know than not.
        console.warn("[App] Failed to fetch active coupons:", error);
      }
    };

    fetchCoupons();

    // Poll every 3 hours (3 * 60 * 60 * 1000 = 10800000 ms)
    const couponInterval = setInterval(fetchCoupons, 3 * 60 * 60 * 1000);

    return () => clearInterval(couponInterval);
  }, [initializeAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <RouteTracker />
            <ScrollToTop />
            <CookieConsent />
            <ForceChangePasswordDialog />
            <ReactivationModal />
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:productId" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute requireAuth>
                      <Checkout />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/order-summary"
                  element={
                    <ProtectedRoute requireAuth>
                      <OrderSummary />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/order-confirmation/:id"
                  element={
                    <ProtectedRoute requireAuth>
                      <OrderConfirmation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute requireAuth>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/donate" element={<Donate />} />
                <Route path="/events" element={<Events />} />
                <Route path="/event/:eventId" element={<EventDetail />} />
                <Route
                  path="/event/register/:eventId"
                  element={
                    <ProtectedRoute requireAuth>
                      <EventRegistration />
                    </ProtectedRoute>
                  }
                />
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<About />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:postId" element={<BlogPost />} />
                <Route path="/privacy-policy" element={<Privacy />} />
                <Route path="/terms-and-conditions" element={<Terms />} />
                <Route path="/shipping-and-refund-policy" element={<ShippingAndRefund />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/my-orders"
                  element={
                    <ProtectedRoute requireAuth>
                      <MyOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-orders/:id"
                  element={
                    <ProtectedRoute requireAuth>
                      <UserOrderDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/delete"
                  element={
                    <ProtectedRoute requireAuth>
                      <AccountDeletion />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Admin Routes - Strictly for Admin */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<ProductsManagement />} />
                <Route
                  path="categories"
                  element={<AllCategoriesManagement />}
                />
                <Route path="orders" element={<OrdersManagement />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="events" element={<EventsManagement />} />
                <Route path="blogs" element={<BlogsManagement />} />
                <Route path="gallery" element={<GalleryManagement />} />
                <Route path="carousel" element={<CarouselManagement />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="managers" element={<ManagerManagement />} />
                <Route path="reviews" element={<ReviewsManagement />} />
                <Route path="comments" element={<FlaggedCommentsManagement />} />
                <Route path="faqs" element={<FAQsManagement />} />
                <Route
                  path="contact-management"
                  element={<ContactManagement />}
                />
                <Route path="contact-messages" element={<ContactMessages />} />
                <Route path="contact-messages/:id" element={<ContactMessageDetail />} />
                <Route path="about-us" element={<AboutUsManagement />} />
                <Route path="policies" element={<PolicyManagement />} />
                <Route path="jobs" element={<JobsManagement />} />

                <Route path="settings" element={<SettingsManagement />} />
              </Route>

              {/* Manager Routes - For Managers (and Admins if they visit) */}
              <Route
                path="/manager"
                element={
                  <ProtectedRoute allowedRoles={["manager", "admin"]}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                {/* Reuse same components but accessed via /manager/... */}
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<ProductsManagement />} />
                <Route
                  path="categories"
                  element={<AllCategoriesManagement />}
                />
                <Route path="orders" element={<OrdersManagement />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="events" element={<EventsManagement />} />
                <Route path="blogs" element={<BlogsManagement />} />
                <Route path="gallery" element={<GalleryManagement />} />
                <Route path="carousel" element={<CarouselManagement />} />
                {/* Managers don't manage users/managers usually, but let RBAC handle inside components if needed */}
                {/* UsersManagement removed from Manager routes to prevent Admin Management access */}
                {/* ManagerManagement likely SHOULD BE HIDDEN for managers - will handle in Sidebar/Layout */}
                <Route path="reviews" element={<ReviewsManagement />} />
                <Route path="comments" element={<FlaggedCommentsManagement />} />
                <Route path="faqs" element={<FAQsManagement />} />
                <Route
                  path="contact-management"
                  element={<ContactManagement />}
                />
                <Route path="contact-messages" element={<ContactMessages />} />
                <Route path="contact-messages/:id" element={<ContactMessageDetail />} />
                <Route path="about-us" element={<AboutUsManagement />} />
                <Route path="policies" element={<PolicyManagement />} />

                {/* Managers likely don't access creating managers or system settings */}
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
};

export default App;
