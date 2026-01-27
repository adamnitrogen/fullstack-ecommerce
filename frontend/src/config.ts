/**
 * Centralized configuration for the frontend application.
 * All environment variable access and hardcoded defaults should originate here.
 */

export const CONFIG = {
    // Backend URL: Defaults to port 5001
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5001",

    // API URL: Defaults to backend/api
    get API_BASE_URL() { return import.meta.env.VITE_API_URL || `${this.BACKEND_URL}/api`; },

    // Frontend URL: Defaults to Vite dev port 5173
    FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173",

    // External Services
    GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    RAZORPAY_KEY_ID: import.meta.env.VITE_RAZORPAY_KEY_ID || "",

    // Feature Flags or Constants
    DEFAULT_PAGE_SIZE: 10,
    SUPPORT_EMAIL: 'contact@merigaumata.com',
    DEFAULT_COUNTRY_CODE: 'IN',
};

// Re-export common constants if needed
export const APP_NAME = "Meri Gau Mata";
