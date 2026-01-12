import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  MapPin,
  Phone,
  Mail,
  Link as LinkIcon,
  Send as SendIcon,
} from "lucide-react";
import { PolicyDialog } from "@/components/PolicyDialog";
import { socialMediaService } from "@/services/social-media.service";
import { contactInfoService } from "@/services/contact-info.service";
import { bankDetailsService } from "@/services/bank-details.service";
import { aboutService } from "@/services/about.service";
import { FaWhatsapp } from "react-icons/fa";

const getSocialIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "facebook":
      return Facebook;
    case "twitter":
      return Twitter;
    case "instagram":
      return Instagram;
    case "youtube":
      return Youtube;
    case "linkedin":
      return LinkIcon;
    case "whatsapp":
      return FaWhatsapp;
    case "telegram":
      return SendIcon;
    default:
      return LinkIcon;
  }
};

export function Footer() {
  const [policyDialog, setPolicyDialog] = useState<
    "privacy" | "terms" | "refund" | null
  >(null);

  const { data: socialMediaLinks } = useQuery({
    queryKey: ["social-media-links"],
    queryFn: () => socialMediaService.getAll(),
  });

  const { data: contactInfo } = useQuery({
    queryKey: ["contact-info-public"],
    queryFn: () => contactInfoService.getAll(false),
  });

  const { data: bankDetails = [] } = useQuery({
    queryKey: ["bank-details-public"],
    queryFn: () => bankDetailsService.getAll(false),
  });

  const { data: aboutSettings } = useQuery({
    queryKey: ["aboutUs"],
    queryFn: () => aboutService.getAll(),
  });

  const primaryPhone = contactInfo?.phones.find(p => p.is_primary) || contactInfo?.phones[0];
  const primaryEmail = contactInfo?.emails.find(e => e.is_primary) || contactInfo?.emails[0];
  const address = contactInfo?.address;
  const generalBankAccount = bankDetails.find(b => b.type === 'general' && b.is_active) || bankDetails[0];

  return (
    <>
      <PolicyDialog
        open={policyDialog !== null}
        onOpenChange={(open) => !open && setPolicyDialog(null)}
        type={policyDialog || "privacy"}
      />
      <footer className="bg-[#2C1810] text-[#E6D5AC] pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Brand Section */}
            <div className="space-y-4 min-w-0">
              <h3 className="text-2xl font-bold font-playfair text-[#D4AF37]">
                MeriGauMata
              </h3>
              <p className="text-sm opacity-80 leading-relaxed break-words line-clamp-6 max-w-xs">
                {aboutSettings?.footerDescription ||
                  "Dedicated to the preservation and promotion of indigenous cow culture through sustainable products and education."}
              </p>
              <div className="flex gap-3 mt-6">
                {socialMediaLinks?.map((link) => {
                  const Icon = getSocialIcon(link.platform);
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#B85C3C] transition-colors"
                      aria-label={link.platform}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Quick Links */}
            <div className="min-w-0">
              <h4 className="text-lg font-semibold mb-6 text-[#D4AF37]">
                Quick Links
              </h4>
              <ul className="space-y-3 text-sm opacity-80">
                <li>
                  <Link to="/shop" className="hover:text-[#B85C3C] transition-colors">
                    Shop Products
                  </Link>
                </li>
                <li>
                  <Link to="/events" className="hover:text-[#B85C3C] transition-colors">
                    Upcoming Events
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="hover:text-[#B85C3C] transition-colors">
                    Our Blog
                  </Link>
                </li>
                <li>
                  <Link to="/gallery" className="hover:text-[#B85C3C] transition-colors">
                    Gallery
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="hover:text-[#B85C3C] transition-colors">
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-[#B85C3C] transition-colors">
                    About Us
                  </Link>
                </li>
              </ul>
            </div>

            {/* Customer Service */}
            <div className="min-w-0">
              <h4 className="text-lg font-semibold mb-6 text-[#D4AF37]">
                Customer Service
              </h4>
              <ul className="space-y-3 text-sm opacity-80">
                <li>
                  <Link to="/contact" className="hover:text-[#B85C3C] transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setPolicyDialog("privacy")}
                    className="hover:text-[#B85C3C] transition-colors text-left"
                  >
                    Shipping Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setPolicyDialog("refund")}
                    className="hover:text-[#B85C3C] transition-colors text-left"
                  >
                    Returns & Refunds
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setPolicyDialog("privacy")}
                    className="hover:text-[#B85C3C] transition-colors text-left"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setPolicyDialog("terms")}
                    className="hover:text-[#B85C3C] transition-colors text-left"
                  >
                    Terms & Conditions
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="min-w-0">
              <h4 className="text-lg font-semibold mb-6 text-[#D4AF37]">
                Contact Us
              </h4>
              <ul className="space-y-4 text-sm opacity-80">
                {address && (
                  <li className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 shrink-0 mt-0.5" />
                    <span className="break-words overflow-wrap-anywhere min-w-0">
                      {address.address_line1}
                      {address.address_line2 && <><br />{address.address_line2}</>}
                      <br />
                      {address.city}, {address.state} - {address.pincode}
                      <br />
                      {address.country}
                    </span>
                  </li>
                )}
                {primaryPhone && (
                  <li className="flex items-center gap-3 min-w-0">
                    <Phone className="h-5 w-5 shrink-0" />
                    <a href={`tel:${primaryPhone.number}`} className="hover:text-[#B85C3C] transition-colors break-all">
                      {primaryPhone.number}
                    </a>
                  </li>
                )}
                {primaryEmail && (
                  <li className="flex items-center gap-3 min-w-0">
                    <Mail className="h-5 w-5 shrink-0" />
                    <a
                      href={`mailto:${primaryEmail.email}`}
                      className="hover:text-[#B85C3C] transition-colors break-all overflow-wrap-anywhere"
                    >
                      {primaryEmail.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Bank Details */}
            {generalBankAccount && (
              <div className="min-w-0">
                <h4 className="text-lg font-semibold mb-6 text-[#D4AF37]">
                  Bank Details
                </h4>
                <div className="text-sm opacity-80 space-y-2 min-w-0 w-full">
                  <p className="font-semibold text-[#E6D5AC] break-words">{generalBankAccount.account_name}</p>
                  <p className="text-xs break-words">{generalBankAccount.bank_name}</p>
                  {generalBankAccount.upi_id && (
                    <div className="min-w-0">
                      <p className="text-xs opacity-60">UPI ID</p>
                      <p className="font-mono text-xs break-all">{generalBankAccount.upi_id}</p>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs opacity-60">Account Number</p>
                    <p className="font-mono text-xs break-all">{generalBankAccount.account_number}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs opacity-60">IFSC Code</p>
                    <p className="font-mono text-xs break-all">{generalBankAccount.ifsc_code}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#E6D5AC]/20 pt-8 text-center text-sm opacity-60">
            <p>
              &copy; {new Date().getFullYear()} MeriGauMata. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};
