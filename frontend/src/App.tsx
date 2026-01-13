import { useEffect, useRef, lazy, Suspense } from "react";
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

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderSummary = lazy(() => import("./pages/OrderSummary"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Profile = lazy(() => import("./pages/Profile"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Donate = lazy(() => import("./pages/Donate"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const EventRegistration = lazy(() => import("./pages/EventRegistration"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const ShippingAndRefund = lazy(() => import("./pages/ShippingAndRefund"));
const FAQ = lazy(() => import("./pages/FAQ"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const MyOrders = lazy(() => import("./pages/user/MyOrders"));
const UserOrderDetail = lazy(() => import("./pages/user/UserOrderDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin Pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const ProductsManagement = lazy(() => import("./pages/admin/ProductsManagement"));
const AllCategoriesManagement = lazy(() => import("./pages/admin/AllCategoriesManagement"));
const EventsManagement = lazy(() => import("./pages/admin/EventsManagement"));
const BlogsManagement = lazy(() => import("./pages/admin/BlogsManagement"));
const GalleryManagement = lazy(() => import("./pages/admin/GalleryManagement"));
const CarouselManagement = lazy(() => import("./pages/admin/CarouselManagement"));
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const ManagerManagement = lazy(() => import("./pages/admin/ManagerManagement"));
const ReviewsManagement = lazy(() => import("./pages/admin/ReviewsManagement"));
const FlaggedCommentsManagement = lazy(() => import("./pages/admin/FlaggedCommentsManagement"));
const FAQsManagement = lazy(() => import("./pages/admin/FAQsManagement"));
const ContactManagement = lazy(() => import("./pages/admin/ContactManagement"));
const ContactMessages = lazy(() => import("./pages/admin/ContactMessages"));
const ContactMessageDetail = lazy(() => import("./pages/admin/ContactMessageDetail"));
const AboutUsManagement = lazy(() => import("./pages/admin/AboutUsManagement"));
const PolicyManagement = lazy(() => import("./pages/admin/PolicyManagement"));

const OrdersManagement = lazy(() => import("./pages/admin/OrdersManagement"));
const OrderDetail = lazy(() => import("./pages/admin/OrderDetail"));
const SettingsManagement = lazy(() => import("./pages/admin/SettingsManagement"));

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
    // Restore session from JWT cookie on mount
    initializeAuth();

    // Initialize location data (countries & states)
    useLocationStore.getState().initializeStore();
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
            <Suspense fallback={
              <div className="flex items-center justify-center h-screen w-full bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            }>
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
                </Route>

                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "manager"]}>
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

                  <Route path="settings" element={<SettingsManagement />} />
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
};

export default App;
