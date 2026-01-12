import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { faqService } from "@/services/faq.service";
import { socialMediaService } from "@/services/social-media.service";
import { contactInfoService } from "@/services/contact-info.service";
import { contactService } from "@/services/contact.service";
import { FaWhatsapp } from "react-icons/fa";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Send,
  Link as LinkIcon,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, getErrorDetails } from "@/lib/errorUtils";

export default function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: faqs = [], isLoading: isLoadingFAQs, error: faqError } = useQuery({
    queryKey: ["contact-faqs"],
    queryFn: async () => {
      return await faqService.getAll(false);
    },
  });

  const { data: socialMediaLinks = [], isLoading: isLoadingSocial } = useQuery({
    queryKey: ["social-media-links"],
    queryFn: () => socialMediaService.getAll(),
  });

  const { data: contactInfo, isLoading: isLoadingContact } = useQuery({
    queryKey: ["contact-info-public"],
    queryFn: () => contactInfoService.getAll(false),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.email ||
      !formData.subject ||
      !formData.message
    ) {
      const newErrors: Record<string, string> = {};
      if (!formData.name) newErrors.name = t("contact.name") + " is required";
      if (!formData.email) newErrors.email = t("contact.email") + " is required";
      if (!formData.subject) newErrors.subject = t("contact.subject") + " is required";
      if (!formData.message) newErrors.message = t("contact.message") + " is required";
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await contactService.sendMessage({
        name: formData.name,
        email: formData.email,
        // mapping subject to message body or handled in backend if schema allows.
        // Backend schema expects name, email, message.
        // I should concatenate subject to message or update backend to accept subject.
        // For now, I will prepend subject to message to avoid backend changes if not strictly required, 
        // OR better, send it as part of message but formatted.
        // Actually, backend has metadata support in email service but DB schema usually just has message.
        // Let's check DB schema I created: name, email, message.
        // So I will combine subject and message.
        message: `Subject: ${formData.subject}\n\n${formData.message}`
      });

      toast({
        title: "Success",
        description: "Message sent successfully! We'll get back to you soon.",
      });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error: unknown) {
      console.error('Failed to send message:', error);
      const details = getErrorDetails(error);
      if (details) {
        const backendErrors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          backendErrors[field] = d.message;
        });
        setErrors(backendErrors);
      } else {
        toast({
          title: "Error",
          description: getErrorMessage(error, "Failed to send message. Please try again."),
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "facebook": return Facebook;
      case "twitter": return Twitter;
      case "instagram": return Instagram;
      case "youtube": return Youtube;
      case "linkedin": return LinkIcon;
      case "whatsapp": return FaWhatsapp;
      case "telegram": return Send;
      default: return LinkIcon;
    }
  };

  if (isLoadingFAQs || isLoadingSocial || isLoadingContact) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <Loader2 className="h-8 w-8 animate-spin text-[#B85C3C]" />
      </div>
    )
  }

  const primaryPhone = contactInfo?.phones.find(p => p.is_primary) || contactInfo?.phones[0];
  const primaryEmail = contactInfo?.emails.find(e => e.is_primary) || contactInfo?.emails[0];
  const address = contactInfo?.address;

  return (
    <div className="min-h-screen bg-[#FDFBF7] pt-12 pb-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-3 text-[#2C1810] font-playfair">{t("contact.title")}</h1>
          <p className="text-muted-foreground text-lg">{t("contact.subtitle")}</p>
        </div>

        {/* Contact Info Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Phone Card */}
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#FDFBF7] flex items-center justify-center mb-4 text-[#B85C3C]">
                <Phone className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-[#2C1810] mb-2 text-lg">Phone</h3>
              {primaryPhone ? (
                <div className="text-muted-foreground space-y-1">
                  <p>{primaryPhone.number}</p>
                  {(contactInfo?.phones?.length ?? 0) > 1 && (
                    <p>{contactInfo?.phones?.[1]?.number}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No phone available</p>
              )}
            </CardContent>
          </Card>

          {/* Email Card */}
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#FDFBF7] flex items-center justify-center mb-4 text-[#B85C3C]">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-[#2C1810] mb-2 text-lg">Email</h3>
              {primaryEmail ? (
                <div className="text-muted-foreground space-y-1">
                  <p>{primaryEmail.email}</p>
                  {(contactInfo?.emails?.length ?? 0) > 1 && (
                    <p>{contactInfo?.emails?.[1]?.email}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No email available</p>
              )}
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#FDFBF7] flex items-center justify-center mb-4 text-[#B85C3C]">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-[#2C1810] mb-2 text-lg">Address</h3>
              {address ? (
                <div className="text-muted-foreground">
                  <p>{address.address_line1}</p>
                  <p>{address.city}, {address.state} {address.pincode}</p>
                  <p>{address.country}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No address available</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
          {/* Left Column: Contact Form */}
          <div>
            <Card className="h-full border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl font-bold text-[#2C1810]">
                  {t("contact.sendMessage")}
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">
                  {t("contact.formSubtitle")}
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[#2C1810] font-medium">
                      {t("contact.name")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      required
                      autoComplete="name"
                      className={`bg-[#FDFBF7] border-input/50 focus:bg-white transition-colors h-11 ${errors.name ? "border-destructive" : ""}`}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive mt-1">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#2C1810] font-medium">
                      {t("contact.email")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                      required
                      autoComplete="email"
                      className={`bg-[#FDFBF7] border-input/50 focus:bg-white transition-colors h-11 ${errors.email ? "border-destructive" : ""}`}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-[#2C1810] font-medium">
                      {t("contact.subject")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder={t("contact.subjectPlaceholder")}
                      required
                      className={`bg-[#FDFBF7] border-input/50 focus:bg-white transition-colors h-11 ${errors.subject ? "border-destructive" : ""}`}
                    />
                    {errors.subject && (
                      <p className="text-xs text-destructive mt-1">{errors.subject}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-[#2C1810] font-medium">
                      {t("contact.message")} <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder={t("contact.messagePlaceholder")}
                      rows={6}
                      required
                      className={`bg-[#FDFBF7] border-input/50 focus:bg-white transition-colors resize-none ${errors.message ? "border-destructive" : ""}`}
                    />
                    {errors.message && (
                      <p className="text-xs text-destructive mt-1">{errors.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#B85C3C] hover:bg-[#A04B2E] text-white font-medium h-12 text-base mt-2"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t("contact.sending")}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        {t("contact.send")}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Map, Hours, Socials */}
          <div className="space-y-6">
            {/* Map Section */}
            <Card className="overflow-hidden border-none shadow-sm bg-white">
              <div className="h-64 w-full bg-muted relative">
                {isLoadingContact ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  </div>
                ) : (
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(
                      [
                        contactInfo?.address?.address_line1,
                        contactInfo?.address?.city,
                        contactInfo?.address?.state,
                        contactInfo?.address?.pincode,
                        contactInfo?.address?.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Vrindavan, Mathura"
                    )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    title="Office Location"
                  ></iframe>
                )}
              </div>
              <div className="p-4">
                <Button
                  variant="outline"
                  className="w-full border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white h-11"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [
                          contactInfo?.address?.address_line1,
                          contactInfo?.address?.city,
                          contactInfo?.address?.state,
                          contactInfo?.address?.pincode,
                          contactInfo?.address?.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Vrindavan, Mathura"
                      )}`,
                      "_blank"
                    )
                  }
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  {t("contact.openInMaps")}
                </Button>
              </div>
            </Card>

            {/* Office Hours */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold text-[#2C1810]">Office Hours</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {contactInfo?.officeHours && contactInfo.officeHours.length > 0 ? (
                    (() => {
                      // Helper function to format time from 24hr to 12hr with AM/PM
                      const formatTime = (time: string): string => {
                        if (!time) return '';
                        const [hours, minutes] = time.split(':');
                        const hour = parseInt(hours);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour % 12 || 12;
                        return `${displayHour}:${minutes} ${ampm}`;
                      };

                      // Day abbreviations
                      const dayAbbr: Record<string, string> = {
                        'Monday': 'Mon',
                        'Tuesday': 'Tue',
                        'Wednesday': 'Wed',
                        'Thursday': 'Thu',
                        'Friday': 'Fri',
                        'Saturday': 'Sat',
                        'Sunday': 'Sun'
                      };

                      // Format day range
                      const formatDayRange = (days: string[]): string => {
                        if (days.length === 1) return days[0];
                        if (days.length === 2) return `${dayAbbr[days[0]]}-${dayAbbr[days[1]]}`;
                        return `${dayAbbr[days[0]]}-${dayAbbr[days[days.length - 1]]}`;
                      };

                      interface GroupedHours {
                        days: string[];
                        open_time: string;
                        close_time: string;
                        is_closed: boolean;
                      }

                      const groupedHours = (contactInfo?.officeHours || []).reduce((groups: GroupedHours[], current) => {
                        const lastGroup = groups[groups.length - 1];
                        if (lastGroup &&
                          lastGroup.open_time === current.open_time &&
                          lastGroup.close_time === current.close_time &&
                          lastGroup.is_closed === current.is_closed) {
                          lastGroup.days.push(current.day_of_week);
                        } else {
                          groups.push({
                            days: [current.day_of_week],
                            open_time: current.open_time || "",
                            close_time: current.close_time || "",
                            is_closed: !!current.is_closed
                          });
                        }
                        return groups;
                      }, []);

                      return groupedHours.map((group, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-[#2C1810] font-medium">
                            {formatDayRange(group.days)}
                          </span>
                          <span className="text-muted-foreground">
                            {group.is_closed
                              ? "Closed"
                              : `${formatTime(group.open_time)} - ${formatTime(group.close_time)}`}
                          </span>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Office hours not available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Follow Us */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold text-[#2C1810]">{t("contact.followUs")}</CardTitle>
                <p className="text-sm text-muted-foreground">Stay connected on social media</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex gap-3 flex-wrap">
                  {socialMediaLinks.map((social) => {
                    const Icon = getSocialIcon(social.platform);
                    return (
                      <a
                        key={social.id}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-[#FDFBF7] flex items-center justify-center text-[#2C1810] hover:bg-[#B85C3C] hover:text-white transition-all duration-300"
                        aria-label={social.platform}
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    );
                  })}
                  {socialMediaLinks.length === 0 && (
                    <p className="text-sm text-muted-foreground">No social links available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        <section className="py-12 bg-[#F8F9FA] rounded-3xl px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#2C1810] mb-3 font-playfair">
              {t("contact.faqTitle")}
            </h2>
            <p className="text-muted-foreground">
              {t("contact.faqSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-10">
            {isLoadingFAQs ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-none shadow-sm bg-white">
                  <CardContent className="p-6">
                    <div className="h-6 bg-muted rounded w-3/4 animate-pulse mb-4"></div>
                    <div className="h-4 bg-muted rounded w-full animate-pulse mb-2"></div>
                    <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
                  </CardContent>
                </Card>
              ))
            ) : faqError ? (
              <div className="col-span-2 text-center">
                <p className="text-destructive">{t("contact.faqError")}</p>
              </div>
            ) : (
              faqs.slice(0, 4).map((faq) => (
                <Card key={faq.id} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-[#2C1810] mb-3 text-lg">{faq.question}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="text-center">
            <Link to="/faq">
              <Button variant="outline" className="border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white px-8">
                {t("contact.viewAllFaqs")}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
