import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { ProductQuickView } from "@/components/ProductQuickView";
import { EventCard } from "@/components/EventCard";
import { BlogCard } from "@/components/BlogCard";
import { TestimonialModal } from "@/components/TestimonialModal";
import { TestimonialCard } from "@/components/TestimonialCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Product, Testimonial } from "@/types";
import { galleryFolderService } from "@/services/gallery-folder.service";
import { galleryItemService, GalleryItem } from "@/services/gallery-item.service";
import {
  Milk,
  Leaf,
  Recycle,
  Heart,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-react";

const Index = () => {
  const { t } = useTranslation();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null
  );
  const [selectedTestimonial, setSelectedTestimonial] =
    useState<Testimonial | null>(null);

  const { data: productsData } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const { productService } = await import("@/services/product.service");
      const { products } = await productService.getAll({ limit: 8, page: 1 });
      // Sort by createdAt descending (newest first)
      const sortedProducts = products.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      return { data: sortedProducts };
    },
  });

  const { data: eventsData } = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: async () => {
      const { eventService } = await import("@/services/event.service");
      const { events: allEvents } = await eventService.getAll();

      // Filter for ongoing and upcoming events only (no completed)
      const ongoingEvents = allEvents
        .filter(event => event.status === "ongoing")
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      const upcomingEvents = allEvents
        .filter(event => event.status === "upcoming")
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      // Combine: ongoing first, then upcoming, limited to 10 total
      const combinedEvents = [...ongoingEvents, ...upcomingEvents].slice(0, 10);

      return { data: combinedEvents };
    },
  });

  const { data: blogsData } = useQuery({
    queryKey: ["blogs", "latest"],
    queryFn: async () => {
      const { blogService } = await import("@/services/blog.service");
      const allBlogs = await blogService.getAll();
      // Filter published blogs and sort by date descending (newest first)
      const publishedBlogs = allBlogs
        .filter(blog => blog.published)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { data: publishedBlogs };
    },
  });

  const { data: testimonialsData } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const { testimonialService } = await import("@/services/testimonial.service");
      const allTestimonials = await testimonialService.getAll();
      return { data: allTestimonials };
    },
  });

  const { data: galleryItems = [] } = useQuery<GalleryItem[]>({
    queryKey: ["gallery-items-homepage"],
    queryFn: () => galleryItemService.getAll(),
  });

  const featuredProducts = productsData?.data.slice(0, 8) || [];
  const upcomingEvents = eventsData?.data.slice(0, 8) || [];
  const latestBlogs = blogsData?.data.slice(0, 8) || [];
  const testimonials = testimonialsData?.data || [];
  const latestGalleryItems = galleryItems.slice(0, 8);

  const productsScrollRef = useRef<HTMLDivElement>(null);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const testimonialsScrollRef = useRef<HTMLDivElement>(null);

  const scroll = (
    ref: React.RefObject<HTMLDivElement>,
    direction: "left" | "right"
  ) => {
    if (ref.current) {
      const scrollAmount = 400;
      ref.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;

    const container = ref.current;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    // When scrolled to the end, reset to beginning
    if (scrollLeft + clientWidth >= scrollWidth - 10) {
      container.scrollLeft = 0;
    }
    // When scrolled to the beginning (backward), jump to end
    else if (scrollLeft <= 10) {
      container.scrollLeft = (scrollWidth - clientWidth) / 2;
    }
  };

  const benefits = [
    {
      icon: Milk,
      title: "Pure Dairy Products",
      description: "Fresh milk, ghee, and dairy products rich in nutrients",
    },
    {
      icon: Leaf,
      title: "Organic & Natural",
      description: "Chemical-free, traditional farming methods",
    },
    {
      icon: Recycle,
      title: "Eco-Friendly",
      description: "Sustainable farming with natural fertilizers",
    },
    {
      icon: Heart,
      title: "Cultural Heritage",
      description: "Preserving ancient wisdom and traditions",
    },
  ];

  return (
    <div className="min-h-screen">
      <ProductQuickView
        product={quickViewProduct}
        open={quickViewProduct !== null}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
      />

      <TestimonialModal
        testimonial={selectedTestimonial}
        open={selectedTestimonial !== null}
        onClose={() => setSelectedTestimonial(null)}
      />

      {/* Hero Carousel */}
      <HeroCarousel />



      {/* Featured Products */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                {t("products.title")}
              </h2>
              <p className="text-muted-foreground">
                Discover our range of pure, organic cow products
              </p>
            </div>
            <Link to="/shop">
              <Button variant="outline">{t("products.viewAll")}</Button>
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="relative">
              {featuredProducts.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-lg bg-background"
                  onClick={() => scroll(productsScrollRef, "left")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div
                ref={productsScrollRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {featuredProducts.map((product) => (
                  <div key={product.id} className="flex-shrink-0 w-[320px]">
                    <ProductCard
                      product={product}
                      onQuickView={setQuickViewProduct}
                    />
                  </div>
                ))}
              </div>
              {featuredProducts.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-lg bg-background"
                  onClick={() => scroll(productsScrollRef, "right")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground text-lg">
                No products available at the moment
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Latest Events
              </h2>
              <p className="text-muted-foreground">
                Ongoing and upcoming events - Join us in our community programs
              </p>
            </div>
            <Link to="/events">
              <Button variant="outline">{t("events.viewAll")}</Button>
            </Link>
          </div>

          {upcomingEvents.length > 0 ? (
            <div className="relative">
              {upcomingEvents.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-lg bg-background"
                  onClick={() => scroll(eventsScrollRef, "left")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div
                ref={eventsScrollRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex-shrink-0 w-[420px]">
                    <EventCard event={event} />
                  </div>
                ))}
              </div>
              {upcomingEvents.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-lg bg-background"
                  onClick={() => scroll(eventsScrollRef, "right")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-background rounded-lg">
              <p className="text-muted-foreground text-lg">
                No upcoming events at the moment
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Benefits of Cow */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {t("benefits.title")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("benefits.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="text-center p-6 rounded-lg bg-card shadow-soft hover:shadow-elevated transition-all animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <benefit.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New - Blogs */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                {t("whatsNew")}
              </h2>
              <p className="text-muted-foreground">
                Latest news and articles from our community
              </p>
            </div>
            <Link to="/blog">
              <Button variant="outline">View All</Button>
            </Link>
          </div>

          {latestBlogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {latestBlogs.map((blog) => (
                <BlogCard key={blog.id} blog={blog} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-background rounded-lg">
              <p className="text-muted-foreground text-lg">
                No blog posts available at the moment
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              What People Say About Us
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Hear from our satisfied customers and community members
            </p>
            <Link to="/about#testimonials">
              <Button variant="outline" size="lg">
                <MessageSquare className="h-5 w-5 mr-2" />
                Share Your Story
              </Button>
            </Link>
          </div>

          {testimonials.length > 0 ? (
            <div className="relative">
              {testimonials.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-lg bg-background"
                  onClick={() => scroll(testimonialsScrollRef, "left")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div
                ref={testimonialsScrollRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide py-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {testimonials.map((testimonial: Testimonial) => (
                  <TestimonialCard
                    key={testimonial.id}
                    testimonial={testimonial}
                    onClick={() => setSelectedTestimonial(testimonial)}
                  />
                ))}
              </div>
              {testimonials.length > 1 && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-lg bg-background"
                  onClick={() => scroll(testimonialsScrollRef, "right")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground text-lg">
                No testimonials yet. Be the first to share your experience!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;
