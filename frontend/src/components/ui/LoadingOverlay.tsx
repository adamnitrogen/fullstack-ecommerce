import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isLoading,
    message = 'Loading...'
}) => {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {message}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Please wait while we process your request
                    </p>
                </div>
            </div>
        </div>
    );
};
