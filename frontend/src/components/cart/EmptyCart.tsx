import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export const EmptyCart = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-50 duration-500">
            <div className="w-32 h-32 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                <ShoppingBag className="w-16 h-16 text-primary/40" />
            </div>

            <h1 className="text-3xl font-bold mb-3 font-playfair text-foreground">
                Your cart is empty
            </h1>

            <p className="text-muted-foreground max-w-sm mb-8">
                Looks like you haven't added anything to your cart yet.
                Explore our collection of authentic products.
            </p>

            <Button
                onClick={() => navigate("/shop")}
                size="lg"
                className="text-lg px-8 py-6 h-auto rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
            >
                Start Shopping
            </Button>
        </div>
    );
};
