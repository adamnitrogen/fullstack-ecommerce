import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import {
  Heart,
  Target,
  Eye,
  Users,
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  Flag,
  Star,
  Shield,
  Zap,
  LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/Tag";
import { Separator } from "@/components/ui/separator";
import { TestimonialForm } from "@/components/TestimonialForm";

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  Heart,
  Target,
  Eye,
  Users,
  TrendingUp,
  Award,
  Flag,
  Star,
  Shield,
  Zap,
  CheckCircle2,
};

export default function About() {
  const { t } = useTranslation();

  const { data: aboutContent, isLoading } = useQuery({
    queryKey: ["aboutUs"],
    queryFn: () => aboutService.getAll(),
  });

  if (isLoading || !aboutContent) {
    return (
      <div className="min-h-screen bg-background py-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Fallback for backwards compatibility - show all sections by default if visibility is not set
  const visibility = aboutContent.sectionVisibility || {
    missionVision: true,
    impactStats: true,
    ourStory: true,
    team: true,
    futureGoals: true,
    callToAction: true,
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("about.title")}</h1>
          <p className="text-muted-foreground">{t("about.subtitle")}</p>
        </div>

        {/* Mission & Vision */}
        {visibility.missionVision && (
          <section className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {aboutContent.cards
                .sort((a, b) => a.order - b.order)
                .map((card) => {
                  const IconComponent = iconMap[card.icon] || Target;
                  return (
                    <Card
                      key={card.id}
                      className="hover-scale transition-smooth"
                    >
                      <CardHeader>
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-2xl">{card.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground leading-relaxed">
                          {card.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        )}

        {/* Impact Statistics */}
        {visibility.impactStats && (
          <section className="py-16 bg-muted/30">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  {t("about.ourImpact")}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t("about.impactSubtitle")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {aboutContent.impactStats
                  .sort((a, b) => a.order - b.order)
                  .map((stat) => {
                    const IconComponent = iconMap[stat.icon] || TrendingUp;
                    return (
                      <Card key={stat.id} className="text-center">
                        <CardContent className="pt-6">
                          <IconComponent className="h-12 w-12 text-primary mx-auto mb-4" />
                          <div className="text-4xl font-bold text-primary mb-2">
                            {stat.value}
                          </div>
                          <p className="text-muted-foreground">{stat.label}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          </section>
        )}

        {/* Our Story - Timeline */}
        {visibility.ourStory && (
          <section className="py-16">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  {t("about.ourStory")}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t("about.storySubtitle")}
                </p>
              </div>

              <div className="max-w-4xl mx-auto">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border hidden md:block" />

                  <div className="space-y-8">
                    {aboutContent.timeline
                      .sort((a, b) => a.order - b.order)
                      .map((item, index) => (
                        <div
                          key={item.id}
                          className="relative flex items-start gap-6 md:gap-8"
                        >
                          {/* Timeline dot and line connector */}
                          <div className="flex flex-col items-center">
                            <div className="w-4 h-4 rounded-full bg-primary z-10" />
                            {index < aboutContent.timeline.length - 1 && (
                              <div className="w-0.5 bg-border flex-grow" />
                            )}
                          </div>

                          {/* Content */}
                          <Card className="flex-1 hover-scale transition-smooth p-4 md:p-6">
                            <CardHeader className="p-0 mb-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {item.month} {item.year}
                                </span>
                              </div>
                              <CardTitle className="text-lg md:text-xl mt-1">
                                {item.title}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                              <CardDescription className="text-sm leading-relaxed">
                                {item.description}
                              </CardDescription>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Team Section */}
        {visibility.team && (
          <section className="py-16 bg-muted/30">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  {t("about.meetTeam")}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t("about.teamSubtitle")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {aboutContent.teamMembers
                  .sort((a, b) => a.order - b.order)
                  .map((member) => (
                    <Card
                      key={member.id}
                      className="overflow-hidden hover-scale transition-smooth"
                    >
                      <div className="aspect-square overflow-hidden">
                        <img
                          src={member.image}
                          alt={member.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      </div>
                      <CardHeader>
                        <CardTitle className="text-lg">{member.name}</CardTitle>
                        <CardDescription className="text-primary font-medium">
                          {member.role}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {member.bio}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* Future Goals */}
        {visibility.futureGoals && (
          <section className="py-16">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-foreground mb-4">
                    {t("about.futureGoals")}
                  </h2>
                  <p className="text-muted-foreground">
                    {t("about.goalsSubtitle")}
                  </p>
                </div>

                <div className="space-y-6">
                  {aboutContent.futureGoals
                    .sort((a, b) => a.order - b.order)
                    .map((goal) => (
                      <Card key={goal.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-2">
                                {goal.title}
                              </h3>
                              <p className="text-muted-foreground">
                                {goal.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Call to Action */}
        {visibility.callToAction && (
          <section className="py-16 bg-gradient-to-r from-primary/10 to-secondary/10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  {t("about.joinUs")}
                </h2>
                <p className="text-muted-foreground mb-8">
                  {t("about.joinUsSubtitle")}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a href="/donate">
                    <button className="px-8 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:opacity-90 transition-smooth">
                      {t("about.donateNow")}
                    </button>
                  </a>
                  <a href="/events">
                    <button className="px-8 py-3 bg-secondary text-secondary-foreground rounded-md font-semibold hover:opacity-90 transition-smooth">
                      {t("about.volunteer")}
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Share Your Experience - Testimonial Form */}
        <section id="testimonials" className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                What Do You Think About Us?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Your feedback helps us improve and inspires others to join our
                cause. Share your experience with our community.
              </p>
            </div>
            <TestimonialForm />
          </div>
        </section>
      </div>
    </div>
  );
}
