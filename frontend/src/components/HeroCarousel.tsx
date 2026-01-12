import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getCarouselSlides } from "@/lib/services/carousel.service";

export const HeroCarousel = () => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Fetch carousel slides from Backend
  const { data: slides = [] } = useQuery({
    queryKey: ["carousel-slides"],
    queryFn: getCarouselSlides,
  });

  useEffect(() => {
    if (slides.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  if (slides.length === 0) {
    return null; // Or a loading skeleton / default placeholder
  }

  // Check if current slide has title or subtitle
  const hasContent =
    slides[currentSlide]?.title || slides[currentSlide]?.subtitle;

  return (
    <div className="relative h-[500px] md:h-[600px] overflow-hidden">
      {slides.map((slide, index) => {
        const slideHasContent = slide.title || slide.subtitle;

        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
          >
            <img
              src={slide.image}
              alt={slide.title || "Hero carousel slide"}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/20" />

            {/* Content positioning based on whether title/subtitle exist */}
            {slideHasContent ? (
              // Default: Content on left side with text
              <div className="absolute inset-0 flex items-center">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="max-w-2xl animate-fade-in">
                    {slide.title && (
                      <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
                        {slide.title}
                      </h1>
                    )}
                    {slide.subtitle && (
                      <p className="text-xl md:text-2xl mb-8 text-white/90">
                        {slide.subtitle}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Link to="/shop" className="w-full sm:w-auto">
                        <Button
                          variant="hero"
                          size="lg"
                          className="w-full sm:w-auto"
                        >
                          {t("hero.exploreProducts")}
                        </Button>
                      </Link>
                      <Link to="/donate" className="w-full sm:w-auto">
                        <Button
                          variant="donate"
                          size="lg"
                          className="w-full sm:w-auto"
                        >
                          {t("hero.donate")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // No content: Buttons at bottom center
              <div className="absolute inset-0 flex items-end justify-center pb-16">
                <div className="animate-fade-in">
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link to="/shop">
                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full sm:w-auto min-w-[200px]"
                      >
                        {t("hero.exploreProducts")}
                      </Button>
                    </Link>
                    <Link to="/donate">
                      <Button
                        variant="donate"
                        size="lg"
                        className="w-full sm:w-auto min-w-[200px]"
                      >
                        {t("hero.donate")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${index === currentSlide
              ? "bg-white w-8"
              : "bg-white/50 hover:bg-white/75"
              }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
