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
  Settings,
  Shield,
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
      label: "Products",
      path: "/admin/products",
      show: hasPermission("can_manage_products")
    },
    {
      icon: Folder,
      label: "Categories",
      path: "/admin/categories",
      show: hasPermission("can_manage_categories")
    },
    {
      icon: Calendar,
      label: "Events",
      path: "/admin/events",
      show: hasPermission("can_manage_events")
    },
    {
      icon: FileText,
      label: "Blogs",
      path: "/admin/blogs",
      show: hasPermission("can_manage_blogs")
    },
    {
      icon: Image,
      label: "Gallery",
      path: "/admin/gallery",
      show: hasPermission("can_manage_gallery")
    },
    {
      icon: Image,
      label: "Carousel",
      path: "/admin/carousel",
      show: hasPermission("can_manage_carousel")
    },
    {
      icon: ShoppingCart,
      label: "Orders",
      path: "/admin/orders",
      show: hasPermission("can_manage_orders")
    },
    {
      icon: Users,
      label: "Managers",
      path: "/admin/managers",
      show: isAdmin // Only admins can manage managers
    },
    {
      icon: Star,
      label: "Reviews",
      path: "/admin/reviews",
      show: hasPermission("can_manage_products")
    },
    {
      icon: Flag,
      label: "Moderation",
      path: "/admin/comments",
      show: hasPermission("can_manage_blogs"),
    },

    {
      icon: HelpCircle,
      label: "FAQs",
      path: "/admin/faqs",
      show: hasPermission("can_manage_faqs")
    },
    {
      icon: Contact,
      label: "Contact Info",
      path: "/admin/contact-management",
      show: hasPermission("can_manage_contact_info") || hasPermission("can_manage_social_media") || hasPermission("can_manage_bank_details") || hasPermission("can_manage_newsletter")
    },
    {
      icon: Info,
      label: "About Us",
      path: "/admin/about-us",
      show: hasPermission("can_manage_about_us")
    },
    // Coupons Management moved to Settings > Coupons
    // {
    //   icon: Tag,
    //   label: "Coupons",
    //   path: "/admin/coupons",
    //   show: isAdmin // Only admins can manage coupons
    // },
    {
      icon: Shield,
      label: "Policy Management",
      path: "/admin/policies",
      show: isAdmin || hasPermission("can_manage_about_us") // Assuming generic permission or admin for now, user didn't specify strict permission but implied Admin
    },
    {
      icon: Settings,
      label: "Settings",
      path: "/admin/settings",
      show: isAdmin // Only admins can manage global settings
    },
  ];

  const menuItems = allMenuItems.filter(item => item.show);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen bg-card/95 backdrop-blur-sm border-r transition-all duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${isCollapsed ? "w-16" : "w-64"}`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b px-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-2xl transition-transform hover:scale-110 duration-200">🐄</span>
              {!isCollapsed && <span className="font-bold truncate animate-in fade-in duration-300">{isManager ? "Manager" : "Admin"} Panel</span>}
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
              className="hidden md:flex hover:bg-muted"
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/admin"}
                    className={({ isActive }) => `flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"
                      } ${isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted hover:text-foreground text-muted-foreground"
                      }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />}
                        <item.icon className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
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
