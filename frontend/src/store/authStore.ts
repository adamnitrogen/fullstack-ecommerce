import { logger } from "@/lib/logger";
import { create } from "zustand";
import type { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/react-query";
import { apiClient } from "@/lib/api-client";
import { syncSession } from "@/lib/services/auth.service";

// Helper to check if session cookies exist (avoids 401 on first visit)
const hasSessionCookies = (): boolean => {
  const cookies = document.cookie;
  return cookies.includes('sb-access-token') ||
    cookies.includes('sb-refresh-token') ||
    cookies.includes('access_token') ||
    cookies.includes('refresh_token');
};

// Helper to check if a JWT is expired (avoids API calls with stale tokens)
const isTokenExpired = (token: string | undefined): boolean => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Add 30 second buffer for clock skew
    return payload.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isInitialized: boolean;
  isReactivationRequired: boolean;
  setUser: (user: User | null) => void;
  setReactivationRequired: (required: boolean) => void;
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
  isInitializing: false,
  isInitialized: false,
  isReactivationRequired: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isReactivationRequired: user?.deletionStatus === 'PENDING_DELETION',
    }),

  setReactivationRequired: (required) =>
    set({ isReactivationRequired: required }),

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

      // Complete local storage wipe
      localStorage.clear();
      sessionStorage.removeItem('active_coupons'); // Explicitly clear coupons
      sessionStorage.clear();

      logger.debug('[AuthStore] Logout completed with full storage wipe (no automatic refresh)');
    } catch (error) {
      logger.error("Logout error:", error);
    }
  },

  initializeAuth: async () => {
    // 1. Skip if already initialized or in progress (to prevent redundant calls)
    if (get().isInitialized || get().isInitializing) return;

    set({ isInitializing: true });

    try {
      // 2. Cleanup previous listeners
      if (authListenerUnsubscribe) {
        authListenerUnsubscribe();
        authListenerUnsubscribe = null;
      }
      if (sessionExpiredHandler) {
        window.removeEventListener('auth:session-expired', sessionExpiredHandler);
      }

      // 3. Set up session expiry listener (from api-client interceptor)
      sessionExpiredHandler = () => {
        logger.warn('[AuthStore] Session expired event received from API Client');
        // Clear state but don't hard redirect yet, let components handle it if they want
        set({ user: null, isAuthenticated: false });
        queryClient.clear();
      };
      window.addEventListener('auth:session-expired', sessionExpiredHandler);

      // 4. Check session via Supabase SDK (uses internal state)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.warn('[AuthStore] Supabase getSession error:', sessionError.message);

          const isRefreshError =
            sessionError.message.includes('Invalid Refresh Token') ||
            sessionError.message.includes('Refresh Token Not Found') ||
            sessionError.message.includes('not found');

          if (isRefreshError) {
            logger.warn('[AuthStore] Detected invalid refresh token, forcing logout cleanup');
            await get().logout();
            set({ isInitializing: false, isInitialized: true });
            return;
          }
        }

        if (session?.user) {
          // User has Supabase session, now verify with backend and sync profile

          // Check if we have session cookies - if not, skip refresh and go straight to sync
          if (!hasSessionCookies()) {
            // But first, check if the token is expired - if so, don't bother making API calls
            if (isTokenExpired(session.access_token)) {
              logger.debug('[AuthStore] Supabase session token expired, clearing stale session');
              await supabase.auth.signOut();
              set({
                user: null,
                isAuthenticated: false,
                isInitialized: true,
              });
              return;
            }

            logger.debug('[AuthStore] Supabase session exists but no backend cookies, attempting session sync...');
            try {
              const userData = await syncSession(session.access_token, session.refresh_token || '', true);
              if (userData) {
                const user: User = {
                  id: userData.id,
                  email: userData.email || '',
                  name: userData.name || '',
                  phone: userData.phone || undefined,
                  role: userData.role || 'customer',
                  emailVerified: userData.emailVerified,
                  phoneVerified: userData.phoneVerified || false,
                  mustChangePassword: userData.mustChangePassword || false,
                  deletionStatus: userData.deletionStatus,
                  scheduledDeletionAt: userData.scheduledDeletionAt,
                  addresses: [],
                };

                set({
                  user,
                  isAuthenticated: true,
                  isInitialized: true,
                  isReactivationRequired: userData.deletionStatus === 'PENDING_DELETION',
                });
                logger.debug('[AuthStore] Session sync successful (no prior cookies)');
                return;
              }
            } catch (syncError) {
              logger.debug('[AuthStore] Session sync failed (silent):', syncError);
              // Fall through to guest state
            }

            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
            });
            return;
          }

          try {
            // Call backend to refresh/verify and get full profile
            const response = await apiClient.post('/auth/refresh', {}, { silent: true } as any);
            const data = response.data;

            if (data.user) {
              const user: User = {
                id: data.user.id,
                email: data.user.email || '',
                name: data.user.name || '',
                phone: data.user.phone || undefined,
                role: data.user.role || 'customer',
                emailVerified: data.user.emailVerified,
                phoneVerified: data.user.phoneVerified || false,
                mustChangePassword: data.user.mustChangePassword || false,
                deletionStatus: data.user.deletionStatus,
                scheduledDeletionAt: data.user.scheduledDeletionAt,
                addresses: [],
              };

              set({
                user,
                isAuthenticated: true,
                isInitialized: true,
                isReactivationRequired: data.user.deletionStatus === 'PENDING_DELETION',
              });
              logger.debug(`[AuthStore] User initialized and verified with backend (Status: ${data.user.deletionStatus || 'ACTIVE'})`);
            }
          } catch (verifyError: any) {
            // FALLBACK: If refresh fails with 401 (e.g. cookies missing) but we HAVE a session,
            // try to sync the session instead of giving up.
            if (verifyError.response?.status === 401 && session.access_token) {
              logger.info('[AuthStore] Backend verification failed (401), attempting silent session re-sync...');
              try {
                const userData = await syncSession(session.access_token, session.refresh_token || '', true);
                if (userData) {
                  const user: User = {
                    id: userData.id,
                    email: userData.email || '',
                    name: userData.name || '',
                    phone: userData.phone || undefined,
                    role: userData.role || 'customer',
                    emailVerified: userData.emailVerified,
                    phoneVerified: userData.phoneVerified || false,
                    mustChangePassword: userData.mustChangePassword || false,
                    deletionStatus: userData.deletionStatus,
                    scheduledDeletionAt: userData.scheduledDeletionAt,
                    addresses: [],
                  };

                  set({
                    user,
                    isAuthenticated: true,
                    isInitialized: true,
                    isReactivationRequired: userData.deletionStatus === 'PENDING_DELETION',
                  });
                  logger.debug('[AuthStore] Session re-sync successful');
                  return; // Exit successful
                }
              } catch (syncError) {
                logger.debug('[AuthStore] Session re-sync fallback failed (silent):', syncError);
              }
            }

            logger.warn('[AuthStore] Backend verification failed:', verifyError.response?.data?.error || verifyError.message);

            // If backend says 403/410, the session is definitively invalid or account is gone
            if ([403, 410].includes(verifyError.response?.status)) {
              await get().logout(); // Full cleanup for critical errors
            }

            set({
              user: null,
              isAuthenticated: false,
              isInitialized: true,
            });
          }
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

      // 5. Set up Supabase listener (mainly for cross-tab debugging/sync)
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
    } finally {
      set({ isInitializing: false });
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
