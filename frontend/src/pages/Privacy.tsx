import { contactInfoService } from "@/services/contact-info.service";
import { useQuery } from "@tanstack/react-query";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function Privacy() {
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
        <h1 className="text-4xl font-bold mb-8 font-playfair text-[#2C1810]">Privacy Policy</h1>

        <div className="prose prose-lg max-w-none space-y-8 text-foreground/80">

          <div className="text-sm text-muted-foreground pb-4 border-b border-border">
            <strong>Last Updated:</strong> January 2026
          </div>

          <section>
            <p className="leading-relaxed">
              At <strong>MeriGauMata</strong>, we value your privacy. This policy explains how we collect, use, and protect your information when you purchase products, register for events, donate, or browse our content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">1. Information We Collect</h2>
            <p className="mb-4">We collect information you provide directly to us through various sections of our site:</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-[#B85C3C]">
              <li><strong>Shop & Checkout:</strong> Name, shipping address, billing address, and contact details.</li>
              <li><strong>Event Registration:</strong> Name, email, phone number, and any specific requirements (e.g., dietary needs or age).</li>
              <li><strong>Donations:</strong> Name, email, and payment confirmation.</li>
              <li><strong>Interactions:</strong> Comments on Blogs, inquiries via contact forms, and newsletter sign-ups.</li>
              <li><strong>Automated Data:</strong> IP addresses and cookies to help us understand how you use our Gallery and other pages.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use your data to:</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-[#B85C3C]">
              <li>Process and deliver your Product orders.</li>
              <li>Manage Event logistics and send reminders.</li>
              <li>Process Donations and send acknowledgments.</li>
              <li>Improve our Blog content based on user engagement.</li>
              <li>Maintain the security of our website.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">3. Third-Party Sharing</h2>
            <p className="mb-4">We do not sell your personal data. We only share information with trusted partners necessary to run our site:</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-[#B85C3C]">
              <li>
                <strong>Payment Information:</strong> All payment transactions are processed through <strong>Razorpay</strong>, a secure third-party payment gateway. We do not store or process your credit/debit card details on our servers. Razorpay complies with the Payment Card Industry Data Security Standard (PCI-DSS) for secure data handling.
              </li>
              <li><strong>Courier Partners:</strong> To ship products to your address.</li>
              <li><strong>Email Services:</strong> To send you newsletters or order updates (via Amazon SES / MailerSend).</li>
              <li><strong>Hosting Provider:</strong> Our services are securely hosted on Hostinger.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">4. Cookies and Analytics</h2>
            <p className="leading-relaxed">
              Our website uses cookies to enhance your experience. For example, cookies help us remember what is in your shopping cart and analyze which photos in our Gallery are most popular. You can disable cookies in your browser settings, though some site features may stop working. Essential cookies required for authentication and site security cannot be disabled.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">5. Data Security</h2>
            <p className="leading-relaxed">
              We implement standard security measures, including SSL encryption, to protect your data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">6. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-[#B85C3C]">
              <li>Request a copy of the personal data we hold about you.</li>
              <li>Request that we correct or delete your information.</li>
              <li>Opt-out of marketing emails at any time by clicking "Unsubscribe."</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[#2C1810] mb-4">7. Contact Us</h2>
            <p className="leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
            </p>
            <div className="p-6 bg-[#B85C3C]/5 rounded-xl border border-[#B85C3C]/20">
              <p className="font-semibold text-[#2C1810] mb-2">MeriGauMata Trust</p>
              <div className="space-y-1 text-sm">
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
