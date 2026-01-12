import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
    className?: string;
}

/**
 * Full-page loading overlay component
 * Displays a centered spinner with optional message
 * Covers the entire viewport with a semi-transparent backdrop
 */
export function LoadingOverlay({
    isLoading,
    message = "Please wait...",
    className
}: LoadingOverlayProps) {
    if (!isLoading) return null;

    return (
        <div
            className={cn(
                "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm",
                className
            )}
        >
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/90 shadow-2xl border">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground">{message}</p>
            </div>
        </div>
    );
}

/**
 * Relative loading overlay - for use within a container
 * Parent should have `position: relative`
 */
export function LoadingOverlayRelative({
    isLoading,
    message = "Loading...",
    className
}: LoadingOverlayProps) {
    if (!isLoading) return null;

    return (
        <div
            className={cn(
                "absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg",
                className
            )}
        >
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}
