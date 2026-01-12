import { logger } from "@/lib/logger";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { faqService, type FAQWithCategory } from "@/services/faq.service";

export default function FAQ() {
  const { data: faqs = [], isLoading, error } = useQuery({
    queryKey: ["public-faqs"],
    queryFn: async () => {
      try {
        const data = await faqService.getAll(false);
        logger.debug('FAQs loaded:', data);
        return data;
      } catch (err) {
        logger.error('Error loading FAQs:', err);
        throw err;
      }
    },
  });

  // Group FAQs by category
  const faqsByCategory = faqs.reduce((acc, faq) => {
    const categoryName = faq.category?.name || 'Uncategorized';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(faq);
    return acc;
  }, {} as Record<string, FAQWithCategory[]>);

  const categories = Object.keys(faqsByCategory).sort();

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground">
            Find answers to common questions about our products, services, and
            mission
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
            <p className="text-muted-foreground mt-4">Loading FAQs...</p>
          </div>
        ) : error ? (
          <Card className="p-12 border-destructive">
            <div className="text-center space-y-4">
              <div className="text-6xl">❌</div>
              <h3 className="text-xl font-semibold">Unable to Load FAQs</h3>
              <p className="text-muted-foreground">
                We're having trouble loading the FAQs right now. Please try again in a few moments.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          </Card>
        ) : faqs.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="text-6xl">📝</div>
              <h3 className="text-xl font-semibold">No FAQs Available</h3>
              <p className="text-muted-foreground">
                We haven't added any FAQs yet. Please check back soon!
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <Card key={category} className="p-6">
                <h2 className="text-2xl font-semibold mb-4 text-primary">
                  {category}
                </h2>
                <Accordion type="single" collapsible className="w-full">
                  {faqsByCategory[category].map((faq, index) => (
                    <AccordionItem key={faq.id} value={`${category}-${index}`}>
                      <AccordionTrigger>{faq.question}</AccordionTrigger>
                      <AccordionContent className="whitespace-pre-wrap">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            ))}
          </div>
        )}

        {/* Contact CTA */}
        <Card className="mt-12 p-8 text-center bg-gradient-to-r from-primary/10 to-secondary/10">
          <h2 className="text-2xl font-semibold mb-4">Still have questions?</h2>
          <p className="text-muted-foreground mb-6">
            Can't find the answer you're looking for? Please reach out to our
            friendly team.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Contact Us
            </a>
            <a
              href="tel:+919876543210"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Call: +91 98765 43210
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
