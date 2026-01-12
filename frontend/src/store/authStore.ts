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

      // NOTE: Silent logout - no page refresh
      // Navigation (if needed) should be handled by the calling component
      logger.debug('[AuthStore] Logout completed silently');
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

      // 3. Check session via Supabase SDK (uses internal state)
      // NOTE: /auth/me endpoint was removed - session init now uses Supabase directly
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.debug('[AuthStore] Supabase getSession error:', sessionError);
        }

        if (session?.user) {
          // User has valid Supabase session
          const supabaseUser = session.user;
          const user: User = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            name: supabaseUser.user_metadata?.name || '',
            phone: supabaseUser.user_metadata?.phone || undefined,
            role: supabaseUser.user_metadata?.role || 'customer',
            emailVerified: supabaseUser.email_confirmed_at != null,
            phoneVerified: false,
            mustChangePassword: supabaseUser.user_metadata?.must_change_password || false,
            addresses: [],
          };

          set({
            user,
            isAuthenticated: true,
            isInitialized: true,
          });

          logger.debug('[AuthStore] User initialized from Supabase session');
        } else {
          set({
            user: null,
            isAuthenticated: false,
            isInitialized: true,
          });
          logger.debug('[AuthStore] No valid session found (guest)');
        }
      } catch (error: unknown) {
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        });
        logger.debug('[AuthStore] Session check failed, treating as guest');
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
