import { CartResponse, CartItem, Product } from "@/types";

export class CartDTO {
    /**
     * transforms Backend Cart Response to Frontend Cart Item List
     */
    static toCartItems(response: CartResponse): CartItem[] {
        if (!response?.cart?.cart_items) {
            return [];
        }

        const seenProducts = new Set<string>();

        return response.cart.cart_items.map((item) => {
            const showCharge = !seenProducts.has(item.product_id);
            seenProducts.add(item.product_id);

            return {
                productId: item.product_id,
                quantity: item.quantity,
                product: item.products,
                variantId: item.variant_id || undefined,
                variant: item.product_variants,
                delivery_charge: showCharge ? (item.products?.delivery_charge ?? 0) : 0,
            };
        });
    }

    /**
     * transforms Backend Cart Response to Frontend Cart structure (items + totals)
     * if needed for state updates
     */
    static fromResponse(response: CartResponse): { items: CartItem[], totals: CartResponse['totals'], deliverySettings?: CartResponse['totals']['deliverySettings'] } {
        return {
            items: this.toCartItems(response),
            totals: response.totals,
            deliverySettings: response.totals.deliverySettings
        };
    }
}
