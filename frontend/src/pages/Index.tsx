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
import { GalleryItem, galleryItemService } from "@/services/gallery-item.service";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { productService } from "@/services/product.service";
import { eventService } from "@/services/event.service";
import { blogService } from "@/services/blog.service";
import { testimonialService } from "@/services/testimonial.service";
import {
  Milk,
  Leaf,
  Recycle,
  Heart,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";

const Index = () => {
  const { t } = useTranslation();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null
  );
  const [selectedTestimonial, setSelectedTestimonial] =
    useState<Testimonial | null>(null);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const { products } = await productService.getAll({ limit: 8, page: 1 });
      // Sort by createdAt descending (newest first)
      const sortedProducts = products.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      return { data: sortedProducts };
    },
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: async () => {
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

  const { data: blogsData, isLoading: blogsLoading } = useQuery({
    queryKey: ["blogs", "latest"],
    queryFn: async () => {
      const allBlogs = await blogService.getAll();
      // Filter published blogs and sort by date descending (newest first)
      const publishedBlogs = allBlogs
        .filter(blog => blog.published)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { data: publishedBlogs };
    },
  });

  const { data: testimonialsData, isLoading: testimonialsLoading } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const allTestimonials = await testimonialService.getAll();
      return { data: allTestimonials };
    },
  });

  const { data: galleryItems = [], isLoading: galleryLoading } = useQuery<GalleryItem[]>({
    queryKey: ["gallery-items-homepage"],
    queryFn: () => galleryItemService.getAll(),
  });

  const isLoading = productsLoading || eventsLoading || blogsLoading || testimonialsLoading || galleryLoading;

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
      <LoadingOverlay isLoading={isLoading} message="Just a moment..." />
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
      <section className="py-12 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-widest">
                <Leaf className="h-3 w-3" /> Nature's Bounty
              </div>
              <h2 className="text-4xl md:text-6xl font-bold font-playfair text-[#2C1810]">
                {t("products.title")}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">
                Discover our curated selection of pure, organic cow products crafted with ancient wisdom.
              </p>
            </div>
            <Link to="/shop">
              <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto">
                {t("products.viewAll")}
              </Button>
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="group/scroll relative px-2">
              <div
                ref={productsScrollRef}
                className="flex gap-8 overflow-x-auto scrollbar-hide pb-8 pt-4 snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {featuredProducts.map((product) => (
                  <div key={product.id} className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start">
                    <ProductCard
                      product={product}
                      onQuickView={setQuickViewProduct}
                    />
                  </div>
                ))}
              </div>

              {/* Custom Scroll Controls - Premium */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/scroll:opacity-100 -translate-x-6 group-hover/scroll:translate-x-0 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                  onClick={() => scroll(productsScrollRef, "left")}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/scroll:opacity-100 translate-x-6 group-hover/scroll:translate-x-0 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                  onClick={() => scroll(productsScrollRef, "right")}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50">
              <p className="text-muted-foreground text-lg italic font-light">
                No products available at the moment
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="py-12 bg-[#FAF7F2] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 opacity-5 pointer-events-none">
          <Heart className="h-96 w-96 text-[#B85C3C]" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2C1810]/5 text-[#2C1810] text-[10px] font-bold uppercase tracking-widest">
                <Sparkles className="h-3 w-3" /> Community Connection
              </div>
              <h2 className="text-4xl md:text-6xl font-bold font-playfair text-[#2C1810]">
                Sacred Gatherings
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">
                Join our community programs, festivals, and spiritual experiences.
              </p>
            </div>
            <Link to="/events">
              <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                {t("events.viewAll")}
              </Button>
            </Link>
          </div>

          {upcomingEvents.length > 0 ? (
            <div className="group/events-scroll relative px-2">
              <div
                ref={eventsScrollRef}
                className="flex gap-8 overflow-x-auto scrollbar-hide pb-8 pt-4 snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex-shrink-0 w-[300px] sm:w-[420px] snap-start">
                    <EventCard event={event} />
                  </div>
                ))}
              </div>

              {/* Custom Scroll Controls - Premium */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/events-scroll:opacity-100 -translate-x-6 group-hover/events-scroll:translate-x-0 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                  onClick={() => scroll(eventsScrollRef, "left")}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/events-scroll:opacity-100 translate-x-6 group-hover/events-scroll:translate-x-0 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                  onClick={() => scroll(eventsScrollRef, "right")}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-[#2C1810]/10">
              <p className="text-muted-foreground text-lg italic font-light">
                No upcoming events at the moment
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Benefits of Cow */}
      <section className="py-12 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-widest">
              <Milk className="h-3 w-3" /> Ancient Wisdom
            </div>
            <h2 className="text-4xl md:text-5xl font-bold font-playfair text-[#2C1810]">
              {t("benefits.title")}
            </h2>
            <p className="text-muted-foreground text-base md:text-lg font-light max-w-2xl mx-auto">
              {t("benefits.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="group p-8 rounded-[2rem] bg-[#FAF7F2] border border-transparent hover:border-[#B85C3C]/20 hover:bg-white hover:shadow-elevated transition-all duration-500 animate-fade-in flex flex-col items-center text-center"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#B85C3C] group-hover:text-white transition-all duration-500 text-[#B85C3C]">
                  <benefit.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-[#2C1810] mb-3 font-playfair">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground/80 font-light leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New - Blogs */}
      <section className="py-12 bg-[#FAF7F2] relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-widest">
                <Leaf className="h-3 w-3" /> The Journal
              </div>
              <h2 className="text-4xl md:text-5xl font-bold font-playfair text-[#2C1810]">
                {t("whatsNew")}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">
                Latest news, sacred stories, and articles from our community.
              </p>
            </div>
            <Link to="/blog">
              <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                View All Stories
              </Button>
            </Link>
          </div>

          {latestBlogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {latestBlogs.slice(0, 4).map((blog) => (
                <BlogCard key={blog.id} blog={blog} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-[#2C1810]/10">
              <p className="text-muted-foreground text-lg italic font-light">
                No blog posts available at the moment
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-widest">
                <MessageSquare className="h-3 w-3" /> Voice of Community
              </div>
              <h2 className="text-4xl md:text-5xl font-bold font-playfair text-[#2C1810]">
                What People Say
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">
                Hear from our satisfied customers and community members about their divine experiences.
              </p>
            </div>
            <Link to="/about#feedback">
              <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                Share Your Story
              </Button>
            </Link>
          </div>

          {testimonials.length > 0 ? (
            <div className="group/testimonials-scroll relative px-2">
              <div
                ref={testimonialsScrollRef}
                className="flex gap-8 overflow-x-auto scrollbar-hide py-8 pt-4 snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {testimonials.map((testimonial: Testimonial) => (
                  <div key={testimonial.id} className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start">
                    <TestimonialCard
                      testimonial={testimonial}
                      onClick={() => setSelectedTestimonial(testimonial)}
                    />
                  </div>
                ))}
              </div>

              {/* Custom Scroll Controls - Premium */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/testimonials-scroll:opacity-100 -translate-x-6 group-hover/testimonials-scroll:translate-x-0 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                  onClick={() => scroll(testimonialsScrollRef, "left")}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/testimonials-scroll:opacity-100 translate-x-6 group-hover/testimonials-scroll:translate-x-0 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                  onClick={() => scroll(testimonialsScrollRef, "right")}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50">
              <p className="text-muted-foreground text-lg italic font-light">
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
