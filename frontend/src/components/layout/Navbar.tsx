import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Menu,
  X,
  ShoppingCart,
  User,
  Languages,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import AuthPage from "@/pages/Auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";

export const Navbar = () => {
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { getTotalItems, fetchCart, initialized } = useCartStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const cartItemCount = getTotalItems();

  // Fetch cart on mount or when auth changes
  useEffect(() => {
    if (isAuthenticated && !initialized) {
      fetchCart();
    }
  }, [isAuthenticated, initialized, fetchCart]);

  // Auto-open auth dialog if redirected from protected route
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authParam = params.get("auth");
    const returnUrl = params.get("returnUrl");

    if (authParam === "login" && !isAuthenticated) {
      setAuthDialogOpen(true);

      // Store return URL for redirect after login
      if (returnUrl) {
        sessionStorage.setItem("authReturnUrl", returnUrl);
      }

      // Clean up URL (remove query params) but stay on current page
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, isAuthenticated, navigate]);

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = async () => {
    try {
      const { logoutUser } = await import("@/lib/services/auth.service");
      await logoutUser();
      logout();
      navigate("/");
      setLogoutDialogOpen(false);
    } catch (error) {
      logger.error("Logout error:", error);
      // Even if backend fails, clear frontend state
      logout();
      navigate("/");
      setLogoutDialogOpen(false);
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
  };

  const navLinks = [
    { to: "/", label: t("nav.home"), exact: true },
    {
      to: "/shop",
      label: t("nav.shop"),
      matchPaths: ["/shop", "/product", "/cart", "/checkout", "/order-summary"],
    },
    {
      to: "/events",
      label: t("nav.events"),
      matchPaths: ["/events", "/event"],
    },
    { to: "/gallery", label: t("nav.gallery"), exact: false },
    { to: "/about", label: t("nav.about"), exact: false },
    { to: "/blog", label: t("nav.blog"), matchPaths: ["/blog"] },
    { to: "/contact", label: t("nav.contact"), exact: false },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border shadow-soft">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">
                🐄
              </span>
            </div>
            <span className="text-xl font-bold text-primary">MeriGauMata</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              let isActive = false;
              if (link.exact) {
                isActive = location.pathname === link.to;
              } else if (link.matchPaths) {
                isActive = link.matchPaths.some((path) =>
                  location.pathname.startsWith(path)
                );
              } else {
                isActive = location.pathname.startsWith(link.to);
              }
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="relative px-3 py-2 rounded-md text-sm font-medium text-foreground hover:text-primary hover:bg-muted transition-smooth group"
                >
                  {link.label}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-all duration-300 ${isActive
                      ? "opacity-100 scale-x-100"
                      : "opacity-0 scale-x-0 group-hover:opacity-50 group-hover:scale-x-100"
                      }`}
                  />
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => changeLanguage("en")}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage("hi")}>
                  हिन्दी
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cart */}
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* User Menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">{t("nav.profile")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-orders">My Orders</Link>
                  </DropdownMenuItem>
                  {(user?.role === "admin" || user?.role === "manager") && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {user.role === "manager" ? "Manager Portal" : "Admin Portal"}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthDialogOpen(true)}
              >
                {t("nav.login")}
              </Button>
            )}

            {/* Donate Button */}
            <Link to="/donate" className="hidden md:block">
              <Button variant="donate">{t("nav.donate")}</Button>
            </Link>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => {
                let isActive = false;
                if (link.exact) {
                  isActive = location.pathname === link.to;
                } else if (link.matchPaths) {
                  isActive = link.matchPaths.some((path) =>
                    location.pathname.startsWith(path)
                  );
                } else {
                  isActive = location.pathname.startsWith(link.to);
                }
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="relative px-3 py-2 rounded-md text-base font-medium text-foreground hover:text-primary hover:bg-muted transition-smooth"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                    <span
                      className={`absolute bottom-0 left-3 right-3 h-0.5 bg-primary transition-all duration-300 ${isActive
                        ? "opacity-100 scale-x-100"
                        : "opacity-0 scale-x-0"
                        }`}
                    />
                  </Link>
                );
              })}
              <Link
                to="/donate"
                className="mt-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="donate" className="w-full">
                  {t("nav.donate")}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Auth Dialog */}
      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={confirmLogout}
      />
    </nav>
  );
};
