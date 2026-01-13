import { PolicyViewer } from "@/components/PolicyViewer";

export default function ShippingAndRefund() {
    return (
        <PolicyViewer
            type="shipping-refund"
            fallbackContent={
                <div className="text-center py-10">
                    <h1 className="text-3xl font-bold mb-4">Shipping & Refund Policy</h1>
                    <p className="text-muted-foreground">Our Shipping and Refund Policy is currently being updated. Please check back soon.</p>
                </div>
            }
        />
    );
}
