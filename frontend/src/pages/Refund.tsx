import { contactInfoService } from "@/services/contact-info.service";
import { useQuery } from "@tanstack/react-query";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function Refund() {
  const { data: contactInfo, isLoading } = useQuery({
    queryKey: ["contact-info-public"],
    queryFn: () => contactInfoService.getAll(false),
  });

  if (isLoading) {
    return <LoadingOverlay isLoading={true} message="Loading policy..." />;
  }

  const primaryPhone = contactInfo?.phones.find(p => p.is_primary)?.number || "Not Available";
  const primaryEmail = contactInfo?.emails.find(e => e.is_primary)?.email || "Not Available";
  const address = contactInfo?.address ?
    `${contactInfo.address.address_line1}, ${contactInfo.address.city}, ${contactInfo.address.state} ${contactInfo.address.pincode}` :
    "Not Available";

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 font-playfair text-[#2C1810]">Shipping and Refund Policy</h1>
        <p className="text-muted-foreground mb-8">Last Updated: January 2026</p>

        <div className="prose prose-lg max-w-none space-y-8 text-foreground/80">
          <p className="leading-relaxed">
            Thank you for supporting MeriGauMata. Below are the terms and conditions regarding the shipping and return of products purchased on our website.
          </p>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">1. Shipping Policy</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg mb-2">Processing Time</h3>
                <p className="leading-relaxed">
                  All orders are processed within 2–3 business days. Orders are not shipped or delivered on weekends or public holidays.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Couriers</h3>
                <p className="leading-relaxed">
                  Please note that we do not have any fixed third-party courier for shipping. Courier services may vary based on location and availability.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Shipping Rates</h3>
                <p className="leading-relaxed">
                  Shipping charges for your order will be calculated and displayed at checkout.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Delivery Estimates</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-[#B85C3C]">
                  <li>Domestic: 5–7 business days</li>
                  <li>International: We currently do not support international shipping.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Shipment Confirmation & Tracking</h3>
                <p className="leading-relaxed">
                  Once your order has shipped, you will receive a confirmation email containing your tracking number(s).
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Damages</h3>
                <p className="leading-relaxed">
                  If you receive your order damaged, please contact the shipment carrier or our support team immediately. Please save all packaging material and damaged goods before filing a claim.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">2. Returns & Replacements</h2>
            <p className="leading-relaxed mb-4">
              We want you to be happy with your purchase. If you are not entirely satisfied, we're here to help.
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg mb-2">Return Window</h3>
                <p className="leading-relaxed">
                  You have 7 calendar days to return an item from the date you received it.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Condition of Item</h3>
                <p className="leading-relaxed">
                  To be eligible for a return, your item must be unused, in the same condition that you received it, and in its original packaging.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Non-Returnable Items</h3>
                <p className="leading-relaxed">
                  Digital products, event tickets (see below), and items marked as "Final Sale" cannot be returned.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">3. Refunds</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg mb-2">Process</h3>
                <p className="leading-relaxed">
                  Once we receive your item, we will inspect it and notify you that we have received your returned item.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Approval & Timing</h3>
                <p className="leading-relaxed">
                  If your return is approved, we will initiate a refund to your original method of payment. Refund will be processed within <strong>5-7 business days</strong> ONLY after the product is returned to the dealer or owner and successfully inspected.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-lg mb-2">Shipping Costs</h3>
                <p className="leading-relaxed">
                  You will be responsible for paying for your own shipping costs for returning your item. Shipping costs are non-refundable.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">4. Event Ticket Refunds</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg mb-2">Cancellations</h3>
                <p className="leading-relaxed">
                  Registration fees for events are refundable up to 48 hours before the event.
                </p>
              </div>

            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">5. Donation Refunds</h2>
            <p className="leading-relaxed">
              As stated in our Terms and Conditions, donations are generally non-refundable. In the event of a technical error (such as a double-charge), please contact us within 48 hours for a resolution.
            </p>
          </section>

          <section>
            <div className="p-6 bg-[#B85C3C]/5 rounded-xl border border-[#B85C3C]/20 mt-8">
              <p className="font-semibold text-[#2C1810] mb-2">Contact Us</p>
              <div className="space-y-1 text-sm">
                <p>If you have any questions about our Shipping and Refund Policy, please contact us:</p>
                <p><strong>Email:</strong> {primaryEmail}</p>
                <p><strong>Phone:</strong> {primaryPhone}</p>
                <p><strong>Address:</strong> {address}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
