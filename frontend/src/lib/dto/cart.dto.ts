import { CartResponse, CartItem, Product } from "@/types";

export class CartDTO {
    /**
     * transforms Backend Cart Response to Frontend Cart Item List
     */
    static toCartItems(response: CartResponse): CartItem[] {
        if (!response?.cart?.cart_items) {
            return [];
        }

        return response.cart.cart_items.map((item) => ({
            productId: item.product_id,
            quantity: item.quantity,
            product: item.products,
        }));
    }

    /**
     * transforms Backend Cart Response to Frontend Cart structure (items + totals)
     * if needed for state updates
     */
    static fromResponse(response: CartResponse): { items: CartItem[], totals: CartResponse['totals'] } {
        return {
            items: this.toCartItems(response),
            totals: response.totals
        };
    }
}
