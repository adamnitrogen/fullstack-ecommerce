// Track if we're already loading to prevent duplicate script tags
let isLoading = false;
let loadPromise: Promise<boolean> | null = null;

export const loadRazorpay = (): Promise<boolean> => {
    // Return existing promise if already loading
    if (isLoading && loadPromise) {
        return loadPromise;
    }

    // Check if already loaded
    if (window.Razorpay) {
        return Promise.resolve(true);
    }

    isLoading = true;
    loadPromise = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
            isLoading = false;
            resolve(true);
        };
        script.onerror = () => {
            console.error("Failed to load Razorpay SDK");
            isLoading = false;
            resolve(false);
        };
        document.body.appendChild(script);
    });

    return loadPromise;
};

/**
 * Prefetch Razorpay SDK in the background without blocking
 * Call this on pages where payment might be initiated (e.g., cart, checkout)
 */
export const prefetchRazorpay = (): void => {
    if (!window.Razorpay && !isLoading) {
        loadRazorpay().catch(() => {
            // Silently fail - will retry when actually needed
        });
    }
};
