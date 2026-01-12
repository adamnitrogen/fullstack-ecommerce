import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Calendar,
  FileText,
  Image,
  ShoppingCart,
  Users,
  Contact,
  LogOut,
  X,

  ChevronLeft,
  ChevronRight,
  Folder,
  Tag,
  HelpCircle,
  Info,
  Star,
  Flag,
} from "lucide-react";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";

interface AdminSidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onCollapse: () => void;
}

export function AdminSidebar({
  isOpen,
  isCollapsed,
  onToggle,
  onCollapse,
}: AdminSidebarProps) {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { hasPermission, isManager, isAdmin } = useManagerPermissions();

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logout();
    navigate("/");
    setLogoutDialogOpen(false);
  };

  const allMenuItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/admin",
      show: true // Always show dashboard
    },
    {
      icon: Package,
      label: "Products Management",
      path: "/admin/products",
      show: hasPermission("can_manage_products")
    },
    {
      icon: Folder,
      label: "Categories Management",
      path: "/admin/categories",
      show: hasPermission("can_manage_categories")
    },
    {
      icon: Calendar,
      label: "Events Management",
      path: "/admin/events",
      show: hasPermission("can_manage_events")
    },
    {
      icon: FileText,
      label: "Blogs Management",
      path: "/admin/blogs",
      show: hasPermission("can_manage_blogs")
    },
    {
      icon: Image,
      label: "Gallery Management",
      path: "/admin/gallery",
      show: hasPermission("can_manage_gallery")
    },
    {
      icon: Image,
      label: "Carousel Management",
      path: "/admin/carousel",
      show: hasPermission("can_manage_carousel")
    },
    {
      icon: ShoppingCart,
      label: "Orders Management",
      path: "/admin/orders",
      show: hasPermission("can_manage_orders")
    },
    {
      icon: Users,
      label: "Manager Management",
      path: "/admin/managers",
      show: isAdmin // Only admins can manage managers
    },
    {
      icon: Star,
      label: "Reviews Management",
      path: "/admin/reviews",
      show: hasPermission("can_manage_products")
    },
    {
      icon: Flag,
      label: "Flagged Comments",
      path: "/admin/comments",
      show: hasPermission("can_manage_blogs"),
    },

    {
      icon: HelpCircle,
      label: "FAQs Management",
      path: "/admin/faqs",
      show: hasPermission("can_manage_faqs")
    },
    {
      icon: Contact,
      label: "Contact Management",
      path: "/admin/contact-management",
      show: hasPermission("can_manage_contact_info") || hasPermission("can_manage_social_media") || hasPermission("can_manage_bank_details") || hasPermission("can_manage_newsletter")
    },
    {
      icon: Info,
      label: "About Us Management",
      path: "/admin/about-us",
      show: hasPermission("can_manage_about_us")
    },
    {
      icon: Tag,
      label: "Coupons Management",
      path: "/admin/coupons",
      show: isAdmin // Only admins can manage coupons
    },
  ];

  const menuItems = allMenuItems.filter(item => item.show);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen bg-card border-r transition-all duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${isCollapsed ? "w-16" : "w-64"}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b px-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐄</span>
              {!isCollapsed && <span className="font-bold">{isManager ? "Manager" : "Admin"} Panel</span>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={isCollapsed ? onCollapse : onToggle}
              className="md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapse}
              className="hidden md:flex"
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-2">
              {menuItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/admin"}
                    className={`flex items-center rounded-lg py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"
                      }`}
                    activeClassName="bg-accent text-accent-foreground"
                    title={isCollapsed ? item.label : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout */}
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start gap-3 px-3"
                }`}
              onClick={handleLogout}
              title={isCollapsed ? "Logout" : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>Logout</span>}
            </Button>
          </div>
        </div>
      </aside>

      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={confirmLogout}
      />
    </>
  );
}
