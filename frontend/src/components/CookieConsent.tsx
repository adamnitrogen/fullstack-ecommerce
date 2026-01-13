import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Cookie, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none">
      <Card className="max-w-5xl mx-auto pointer-events-auto bg-background/95 backdrop-blur-md border-primary/20 shadow-2xl animate-in slide-in-from-bottom-4 duration-500 rounded-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Visual Side (Desktop) */}
          <div className="hidden md:flex bg-primary/5 w-48 items-center justify-center border-r border-border/50">
            <Cookie className="h-20 w-20 text-primary opacity-80" />
          </div>

          {/* Content Side */}
          <div className="p-6 md:p-8 flex-1">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  We Value Your Privacy
                </h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  We use cookies to enhance your browsing experience, secure our website, and analyze our traffic.
                  <br className="hidden sm:block" />
                  <strong>Essential cookies</strong> are always active to ensure the website functions securely (e.g., authentication, shopping cart).
                </p>
              </div>
              <button
                onClick={handleDecline}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Close banner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <Link
                to="/privacy"
                className="text-primary hover:underline text-sm font-medium transition-colors"
                onClick={() => setShowBanner(false)} // Close banner when navigating to policy
              >
                Read our Privacy Policy
              </Link>

              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  onClick={handleDecline}
                  variant="outline"
                  className="w-full sm:w-auto font-medium"
                >
                  Decline Non-Essential
                </Button>
                <Button
                  onClick={handleAccept}
                  className="w-full sm:w-auto bg-[#B85C3C] hover:bg-[#9A4A2C] text-white font-bold shadow-lg shadow-[#B85C3C]/20"
                >
                  Accept All Cookies
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
