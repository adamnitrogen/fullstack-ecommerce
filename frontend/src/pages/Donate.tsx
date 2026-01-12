import { DonationForm } from "@/components/donation/DonationForm";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { HandHeart, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { donationService } from "@/services/donation.service";

const QrCodeDisplay = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['donationQrCode'],
    queryFn: donationService.getQrCode,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  if (isLoading) {
    return <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded-lg"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (error || !data?.qr_code_url) {
    return (
      <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-muted-foreground text-xs text-center p-2 rounded-lg">
        QR Code unavailable
      </div>
    );
  }

  return (
    <img
      src={data.qr_code_url}
      alt="Donate QR Code"
      className="w-48 h-48 object-contain"
    />
  );
};

const Donate = () => {
  const { t } = useTranslation();

  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <HandHeart className="h-16 w-16 text-primary mx-auto mb-6 animate-pulse" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              {t("donate.title", "Support Our Cause")}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t("donate.subtitle", "Your contribution provides food, shelter, and medical care to cows in need.")}
            </p>
          </div>
        </div>
      </section>

      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-16">

          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-2">
              <DonationForm />
            </div>

            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-none shadow-lg">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">Anonymous Donation</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 text-center">
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    {/* Placeholder or Fetched QR */}
                    <QrCodeDisplay />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Scan this QR code with any UPI app (GPay, PhonePe, Paytm) to donate anonymously instantly.
                  </p>
                  <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                    UPI: &lt;Scan to Pay&gt;
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Why Donate Anonymously?</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>• Avoid filling out long forms</p>
                  <p>• Immediate transfer via UPI</p>
                  <p>• Your identity remains private</p>
                  <p>• No tax receipt generated automatically</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Impact Stats */}
          <section>
            <h2 className="text-3xl font-bold text-center mb-10">{t("donate.whyDonate", "Why Donate?")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">🌾 {t("donate.impact1Title", "Nutritious Food")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t("donate.impact1Desc", "We ensure every cow gets a balanced diet of green fodder and grains.")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">🏥 {t("donate.impact2Title", "Medical Care")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t("donate.impact2Desc", "24/7 veterinary support for injured and aged cows.")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">🏠 {t("donate.impact3Title", "Shelter Maintenance")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t("donate.impact3Desc", "Clean, spacious, and ventilated sheds/gaushalas.")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">💚 {t("donate.impact4Title", "Ethical Treatment")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t("donate.impact4Desc", "We promote kindness and compassion towards all beings.")}</p>
                </CardContent>
              </Card>
            </div>
          </section>



        </div>
      </div>
    </>
  );
};

export default Donate;
