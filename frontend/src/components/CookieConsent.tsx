import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Cookie } from 'lucide-react';
import { PolicyDialog } from '@/components/PolicyDialog';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);

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

  const handleClose = () => {
    // Allow closing without choice, but will show again on next visit
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      <PolicyDialog 
        open={showPrivacyDialog} 
        onOpenChange={setShowPrivacyDialog}
        type="privacy"
      />
      
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none">
        <Card className="max-w-4xl mx-auto pointer-events-auto bg-background/95 backdrop-blur-sm border-2 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 md:p-6">
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close banner"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Icon */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Cookie className="h-6 w-6 text-primary" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg mb-2">We Value Your Privacy</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use cookies to enhance your browsing experience, serve personalized content, 
                    and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. 
                    You can manage your preferences or learn more in our{' '}
                    <button
                      onClick={() => setShowPrivacyDialog(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      Privacy Policy
                    </button>
                    .
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    onClick={handleAccept}
                    className="bg-[#B85C3C] hover:bg-[#9A4A2C] text-white"
                    size="sm"
                  >
                    Accept All
                  </Button>
                  <Button
                    onClick={handleDecline}
                    variant="outline"
                    size="sm"
                    className="border-input hover:bg-accent"
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={() => setShowPrivacyDialog(true)}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Learn More
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
