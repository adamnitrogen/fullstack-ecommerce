import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { Tag, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coupon } from "@/types";
import { couponService } from "@/services/coupon.service";

export function PromotionalBanner() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        checkAndFetchCoupons();

        // Check cache validity every minute (instead of fetching every 30s)
        const validityInterval = setInterval(checkAndFetchCoupons, 60000);

        // Fetch on visibility change (tab becomes visible)
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkAndFetchCoupons();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(validityInterval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    // Auto-rotate through coupons every 5 seconds (only if we have coupons)
    useEffect(() => {
        if (coupons.length <= 1) return;

        const rotateInterval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % coupons.length);
        }, 5000);

        return () => clearInterval(rotateInterval);
    }, [coupons.length]);

    // Add/remove class to body when banner visibility changes
    useEffect(() => {
        const hasActiveCoupons = !loading && coupons.length > 0;
        if (hasActiveCoupons) {
            document.body.classList.add('has-promo-banner');
        } else {
            document.body.classList.remove('has-promo-banner');
        }

        return () => {
            document.body.classList.remove('has-promo-banner');
        };
    }, [loading, coupons.length]);

    const checkAndFetchCoupons = async () => {
        const cacheKey = "promo_coupons_cache";
        const cacheDuration = 60 * 60 * 1000; // 1 hour in milliseconds

        try {
            const cachedData = localStorage.getItem(cacheKey);

            if (cachedData) {
                const { coupons, timestamp } = JSON.parse(cachedData);
                const isExpired = Date.now() - timestamp > cacheDuration;

                if (!isExpired && coupons.length > 0) {
                    setCoupons(coupons);
                    setLoading(false);
                    return;
                }
            }

            // Cache is missing or expired, fetch from API
            fetchActiveCoupons();
        } catch (error) {
            // If local storage fails or parse error, fallback to fetch
            fetchActiveCoupons();
        }
    };

    const fetchActiveCoupons = async () => {
        try {
            const data = await couponService.getActive();
            setCoupons(data);

            // Update cache
            localStorage.setItem("promo_coupons_cache", JSON.stringify({
                coupons: data,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error("Error fetching active coupons:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < coupons.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setCurrentIndex(0);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else {
            setCurrentIndex(coupons.length - 1);
        }
    };

    const getCouponDescription = (coupon: Coupon) => {
        if (coupon.type === "cart") {
            return "Applies to entire cart";
        } else if (coupon.type === "category") {
            return `Applies to ${coupon.target_id} category`;
        } else if (coupon.type === "product") {
            return "Applies to specific product";
        }
        return "";
    };

    if (loading || coupons.length === 0) return null;

    const currentCoupon = coupons[currentIndex];

    return (
        <div className="fixed top-0 left-0 right-0 w-full z-50 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20 backdrop-blur-sm bg-background/95 supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Left Arrow */}
                    {coupons.length > 1 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrev}
                            className="flex-shrink-0"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                    )}

                    {/* Banner Content */}
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center sm:text-left">
                        <div className="flex items-center gap-2">
                            <Tag className="h-5 w-5 text-primary animate-pulse" />
                            <span className="font-semibold text-sm sm:text-base">
                                Special Offer
                            </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                            <Badge variant="default" className="text-base py-1 px-3 font-mono">
                                {currentCoupon.code}
                            </Badge>

                            <div className="flex flex-col sm:flex-row items-center gap-2 text-sm">
                                <span className="font-semibold text-primary">
                                    {currentCoupon.discount_percentage}% OFF
                                </span>
                                <span className="text-muted-foreground hidden sm:inline">|</span>
                                <span className="text-muted-foreground text-xs sm:text-sm">
                                    {getCouponDescription(currentCoupon)}
                                </span>
                            </div>
                        </div>

                        {currentCoupon.min_purchase_amount && currentCoupon.min_purchase_amount > 0 && (
                            <span className="text-xs text-muted-foreground">
                                Min purchase: ₹{currentCoupon.min_purchase_amount}
                            </span>
                        )}

                        {coupons.length > 1 && (
                            <div className="flex items-center gap-1">
                                {coupons.map((_, index) => (
                                    <div
                                        key={index}
                                        className={`h-1.5 rounded-full transition-all ${index === currentIndex
                                            ? "w-6 bg-primary"
                                            : "w-1.5 bg-primary/30"
                                            }`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Arrow */}
                    {coupons.length > 1 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNext}
                            className="flex-shrink-0"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
