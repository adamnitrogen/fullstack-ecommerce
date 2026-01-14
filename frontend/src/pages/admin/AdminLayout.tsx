import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Menu, Home } from "lucide-react";
import { useState, useEffect } from "react";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function AdminLayout() {
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager } = useManagerPermissions();

  useEffect(() => {
    // Subscribe to realtime updates for account deletion jobs
    const subscription = supabase
      .channel('deletion-jobs-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'account_deletion_jobs'
        },
        (payload) => {
          const newStatus = payload.new.status;
          const oldStatus = payload.old.status;

          // Only notify on completion or failure transitions
          if (newStatus !== oldStatus) {
            if (newStatus === 'COMPLETED') {
              toast.success(`Account Deletion Job Completed`, {
                description: `Job ${payload.new.id.slice(0, 8)} finished successfully.`
              });
            } else if (newStatus === 'FAILED') {
              toast.error(`Account Deletion Job Failed`, {
                description: `Job ${payload.new.id.slice(0, 8)} failed. Check logs.`
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        isPinned={sidebarPinned}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onPin={() => setSidebarPinned(!sidebarPinned)}
      />

      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${sidebarOpen ? (sidebarPinned || !sidebarCollapsed ? "md:ml-64" : "md:ml-16") : "ml-0"
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
