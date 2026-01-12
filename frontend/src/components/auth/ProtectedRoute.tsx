import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface ProtectedRouteProps {
    children: ReactNode;
    requireAuth?: boolean; // Requires user to be logged in
    requiredRole?: "admin" | "customer"; // Legacy: Requires specific role
    allowedRoles?: string[]; // New: Requires one of these roles
    redirectTo?: string; // Custom redirect path (default: "/")
}

/**
 * ProtectedRoute Component
 * 
 * Protects routes based on authentication status and user roles.
 * 
 * @example
 * // Require login (any authenticated user)
 * <ProtectedRoute requireAuth>
 *   <Profile />
 * </ProtectedRoute>
 * 
 * // Require admin role
 * <ProtectedRoute allowedRoles={["admin"]}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 * 
 * // Require admin or manager role
 * <ProtectedRoute allowedRoles={["admin", "manager"]}>
 *   <AdminPortal />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
    children,
    requireAuth = false,
    requiredRole,
    allowedRoles,
    redirectTo = "/",
}: ProtectedRouteProps) {
    const { user, isAuthenticated, isInitialized } = useAuthStore();
    const location = useLocation();

    // Show loading while auth is initializing
    if (!isInitialized) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Check if authentication is required
    if (requireAuth && !isAuthenticated) {
        // Redirect to home with login prompt and return URL
        const returnUrl = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/?auth=login&returnUrl=${returnUrl}`} replace />;
    }

    // Determine roles to check
    const rolesToCheck = allowedRoles || (requiredRole ? [requiredRole] : []);

    // Check if specific role is required
    if (rolesToCheck.length > 0 && (!isAuthenticated || !user?.role || !rolesToCheck.includes(user.role))) {
        // If user is not authenticated, redirect to login
        if (!isAuthenticated) {
            const returnUrl = encodeURIComponent(location.pathname + location.search);
            return <Navigate to={`/?auth=login&returnUrl=${returnUrl}`} replace />;
        }

        // If user is authenticated but wrong role

        // Special case: Admins can access customer routes for testing/support
        if (rolesToCheck.includes("customer") && user?.role === "admin") {
            return <>{children}</>;
        }

        // Fallback: redirect
        return <Navigate to={redirectTo} replace />;
    }

    // All checks passed, render the protected content
    return <>{children}</>;
}
