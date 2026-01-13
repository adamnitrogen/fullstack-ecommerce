import { logger } from "@/lib/logger";
import { create } from "zustand";
import { CartItem, Product, CartTotals } from "@/types";
import { cartService } from "@/services/cart.service";
import { toast } from "sonner";
import { CartDTO } from "@/lib/dto/cart.dto";
import axios from "axios";
import { getErrorMessage } from "@/lib/errorUtils";
import { useAuthStore } from "./authStore";

interface CartState {
  items: CartItem[];
  totals: CartTotals | null;
  isLoading: boolean;
  initialized: boolean;
  deliverySettings: { threshold: number; charge: number };

  // Actions
  fetchCart: () => Promise<void>;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  fetchDeliverySettings: () => Promise<void>;
}

// Module-level variables to track timeouts, action queue, and pending requests
const updateTimeouts: Record<string, NodeJS.Timeout> = {};
let actionQueue: Promise<void> = Promise.resolve();
let pendingRequests = 0;

// Helper to calculate totals optimistically
const calculateOptimisticTotals = (items: CartItem[], currentTotals: CartTotals | null): CartTotals => {
  const itemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalMrp = items.reduce((acc, item) => acc + (item.product.mrp || item.product.price) * item.quantity, 0);
  const totalPrice = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  // Apply delivery charge threshold from dynamic settings
  const { threshold, charge } = useCartStore.getState().deliverySettings;
  const deliveryCharge = totalPrice >= threshold ? 0 : charge;

  // Retain coupon info if available but recalculate discounts
  const coupon = currentTotals?.coupon || null;
  const couponDiscount = currentTotals?.couponDiscount || 0;

  const discount = totalMrp - totalPrice;
  const finalAmount = totalPrice + deliveryCharge - couponDiscount;

  return {
    itemsCount,
    totalMrp,
    totalPrice,
    discount,
    couponDiscount,
    deliveryCharge,
    finalAmount,
    coupon
  };
};

export const useCartStore = create<CartState>()((set, get) => {
  // Helper to append actions to the queue with coordination
  const queueAction = (action: () => Promise<void>) => {
    pendingRequests++;
    actionQueue = actionQueue
      .then(action)
      .finally(() => {
        pendingRequests--;
      })
      .catch((error) => {
        logger.error("Cart action failed in queue:", error);
      });
    return actionQueue;
  };

  return {
    items: [],
    totals: null,
    isLoading: false,
    initialized: false,
    deliverySettings: { threshold: 1500, charge: 50 }, // Default values

    fetchCart: async () => {
      // Don't overwrite if we have pending mutations
      if (pendingRequests > 0) return;

      set({ isLoading: true });
      try {
        const response = await cartService.getCart();
        const { items, totals } = CartDTO.fromResponse(response);

        // Coordination: Only apply if no requests were started while we were fetching
        if (pendingRequests === 0) {
          set({
            items,
            totals,
            initialized: true,
            isLoading: false
          });
          // Also fetch delivery settings if not yet fetched or periodically
          if (get().deliverySettings.threshold === 1500) {
            get().fetchDeliverySettings();
          }
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          set({ items: [], totals: null, initialized: true, isLoading: false });
        } else {
          logger.error("Error fetching cart:", error);
          set({ isLoading: false });
          toast.error("Failed to load cart");
        }
      }
    },

    addItem: async (product, quantity = 1) => {
      // 1. Optimistic Update (Immediate)
      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;

      set((state) => {
        const existingItem = state.items.find(item => item.productId === product.id);
        let newItems;

        if (existingItem) {
          newItems = state.items.map(item =>
            item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item
          );
        } else {
          newItems = [...state.items, {
            productId: product.id,
            quantity,
            product
          }];
        }

        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      // 2. Queue the Backend Sync
      return queueAction(async () => {
        try {
          const response = await cartService.addItem(product.id, quantity);
          const { items, totals } = CartDTO.fromResponse(response);

          if (pendingRequests === 1) {
            set({ items, totals });
          }
        } catch (error: unknown) {
          await get().fetchCart();
          const isAuthenticated = useAuthStore.getState().isAuthenticated;

          if (axios.isAxiosError(error) && error.response?.status === 401) {
            if (isAuthenticated) {
              toast.error("Please login to add items to cart");
            }
            // Guest users: suppress the toast
          } else {
            toast.error("Failed to add to cart");
          }
          throw error;
        }
      });
    },

    removeItem: async (productId) => {
      // 1. Optimistic Update
      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;
      const removedItem = previousItems.find(item => item.productId === productId);

      if (!removedItem) return;

      set((state) => {
        const newItems = state.items.filter((item) => item.productId !== productId);
        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      // 2. Queue the Backend Sync
      return queueAction(async () => {
        try {
          const response = await cartService.removeItem(productId);
          const { items, totals } = CartDTO.fromResponse(response);

          if (pendingRequests === 1) {
            set({ items, totals });
          }
        } catch (error) {
          await get().fetchCart();
          const isAuthenticated = useAuthStore.getState().isAuthenticated;

          if (axios.isAxiosError(error) && error.response?.status === 401) {
            if (isAuthenticated) {
              toast.error("Please login to remove items");
            }
            // Guest users: suppress the toast
          } else {
            toast.error("Failed to remove item");
          }
        }
      });
    },

    updateQuantity: async (productId, quantity) => {
      // 1. Optimistic Update
      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;
      const itemToUpdate = previousItems.find(item => item.productId === productId);

      if (!itemToUpdate) return;
      const quantityDiff = quantity - itemToUpdate.quantity;

      set((state) => {
        const newItems = state.items.map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        );
        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      // 2. Debounce + Queue Action
      if (updateTimeouts[productId]) {
        clearTimeout(updateTimeouts[productId]);
      }

      updateTimeouts[productId] = setTimeout(() => {
        queueAction(async () => {
          try {
            const response = await cartService.updateItem(productId, quantity);
            const { items, totals } = CartDTO.fromResponse(response);

            if (pendingRequests === 1) {
              set({ items, totals });
            }
            delete updateTimeouts[productId];
          } catch (error: unknown) {
            await get().fetchCart();
            const isAuthenticated = useAuthStore.getState().isAuthenticated;

            if (axios.isAxiosError(error) && error.response?.status === 401) {
              if (isAuthenticated) {
                toast.error("Please login to update quantity");
              }
              // Guest users: suppress the toast
            } else {
              toast.error("Failed to update quantity");
            }
            delete updateTimeouts[productId];
          }
        });
      }, 300);
    },

    applyCoupon: async (code: string): Promise<boolean> => {
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      if (!isAuthenticated) {
        toast.error("Please login to apply the coupon codes");
        return false;
      }

      set({ isLoading: true });
      try {
        const response = await cartService.applyCoupon(code);
        const { items, totals } = CartDTO.fromResponse(response);

        set({ items, totals, isLoading: false });
        toast.success("Coupon applied successfully");
        return true;
      } catch (error: unknown) {
        set({ isLoading: false });
        const errorMessage = getErrorMessage(error, "Invalid coupon code");
        toast.error(errorMessage);
        return false;
      }
    },

    removeCoupon: async () => {
      set({ isLoading: true });
      try {
        const response = await cartService.removeCoupon();
        const { items, totals } = CartDTO.fromResponse(response);

        set({ items, totals, isLoading: false });
        toast.success("Coupon removed");
      } catch (error) {
        set({ isLoading: false });
        toast.error("Failed to remove coupon");
      }
    },

    clearCart: async () => {
      try {
        await cartService.clearCart();
        set({ items: [], totals: null });
      } catch (error) {
        logger.error("Error clearing cart:", error);
      }
    },

    getTotalItems: () => {
      const state = get();
      return state.items.reduce((total, item) => total + item.quantity, 0);
    },

    getTotalPrice: () => {
      const state = get();
      return state.totals?.finalAmount || 0;
    },

    fetchDeliverySettings: async () => {
      try {
        const settings = await cartService.getDeliverySettings();
        set({
          deliverySettings: {
            threshold: settings.delivery_threshold,
            charge: settings.delivery_charge
          }
        });
      } catch (error) {
        logger.error("Failed to fetch delivery settings:", error);
      }
    }
  };
});
