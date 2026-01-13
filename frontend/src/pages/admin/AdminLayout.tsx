import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Menu, Home } from "lucide-react";
import { useState } from "react";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";

export default function AdminLayout() {
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager } = useManagerPermissions();

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${sidebarOpen ? (sidebarCollapsed ? "md:ml-16" : "md:ml-64") : "ml-0"
          }`}
      >
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-6 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent animate-in fade-in slide-in-from-left-2 duration-500">
                {isManager ? "Manager Portal" : "Admin Portal"}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline-block">
                Welcome, {user?.name || 'User'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                title="Back to Website"
                className="hover:scale-110 transition-transform duration-200"
              >
                <Home className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div key={location.pathname} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
