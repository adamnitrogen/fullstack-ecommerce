import { logger } from "@/lib/logger";
import { create } from "zustand";
import type { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/react-query";
import { apiClient } from "@/lib/api-client";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  login: (user: User) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isAdmin: () => boolean;
  isCustomer: () => boolean;
}

// Store listener cleanup function outside of zustand state
let authListenerUnsubscribe: (() => void) | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  login: (user) => {
    set({
      user,
      isAuthenticated: true,
      isInitialized: true,
    });
  },

  logout: async () => {
    try {
      // Clear local state first
      set({
        user: null,
        isAuthenticated: false,
      });
      queryClient.clear();

      // Sign out from Supabase SDK (clears local storage)
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore SDK errors
      }

      // Clear backend cookies
      try {
        await apiClient.post('/auth/logout');
      } catch (err) {
        logger.warn("Backend logout error (potentially already logged out):", err);
      }

      // Force page reload to clear all in-memory state
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      logger.error("Logout error:", error);
    }
  },

  initializeAuth: async () => {
    try {
      // 1. Cleanup previous listeners
      if (authListenerUnsubscribe) {
        authListenerUnsubscribe();
        authListenerUnsubscribe = null;
      }
      if (sessionExpiredHandler) {
        window.removeEventListener('auth:session-expired', sessionExpiredHandler);
      }

      // 2. Set up session expiry listener (from api-client interceptor)
      sessionExpiredHandler = () => {
        logger.warn('[AuthStore] Session expired event received from API Client');
        // Clear state but don't hard redirect yet, let components handle it if they want
        // or we can force redirect here if needed.
        set({ user: null, isAuthenticated: false });
        queryClient.clear();
      };
      window.addEventListener('auth:session-expired', sessionExpiredHandler);

      // 3. Get current user from backend via cookies
      // We use apiClient here so that its interceptor handles any necessary refresh transparently
      try {
        const response = await apiClient.get('/auth/me');
        const userData = response.data.user;

        if (userData) {
          const user: User = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            phone: userData.phone,
            role: userData.role || 'customer',
            emailVerified: userData.emailVerified,
            phoneVerified: userData.phoneVerified,
            mustChangePassword: userData.mustChangePassword,
            addresses: [],
          };

          set({
            user,
            isAuthenticated: true,
            isInitialized: true,
          });

          logger.debug('[AuthStore] User initialized successfully');
        } else {
          set({
            user: null,
            isAuthenticated: false,
            isInitialized: true,
          });
          logger.debug('[AuthStore] No valid session found (guest)');
        }
      } catch (error: unknown) {
        // If it's a 401, it means refresh also failed or no cookies exist
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        });
        logger.debug('[AuthStore] Auth check failed or guest user');
      }

      // 4. Set up Supabase listener (mainly for cross-tab debugging/sync)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
        logger.debug(`[AuthStore] Supabase auth event: ${event}`);
      });

      authListenerUnsubscribe = () => subscription.unsubscribe();

    } catch (error) {
      logger.error("Initialize auth error:", error);
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
    }
  },

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),

  isAdmin: () => {
    const state = get();
    return state.isAuthenticated && state.user?.role === "admin";
  },

  isCustomer: () => {
    const state = get();
    return state.isAuthenticated && state.user?.role === "customer";
  },
}));
