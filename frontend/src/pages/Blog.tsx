import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Search,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const POSTS_PER_PAGE = 6;

export default function Blog() {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch all blogs from database
  const { data: allBlogs = [], isLoading } = useQuery({
    queryKey: ["blogs"],
    queryFn: async () => {
      const { blogService } = await import("@/services/blog.service");
      return blogService.getAll();
    },
  });

  // Filter only published blogs
  const publishedBlogs = allBlogs.filter((blog) => blog.published);

  // Get 8 latest published blogs for featured section
  const featuredPosts = publishedBlogs
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const categories = [
    { id: "all", label: t("blog.allCategories") },
    { id: "cow-care", label: t("blog.cowCare") },
    { id: "nutrition", label: t("blog.nutrition") },
    { id: "success-stories", label: t("blog.successStories") },
    { id: "events", label: t("blog.events") },
  ];

  // Filter posts
  const filteredPosts = publishedBlogs.filter((post) => {
    const matchesCategory =
      selectedCategory === "all" || post.tags?.includes(selectedCategory);
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const paginatedPosts = filteredPosts.slice(
    startIndex,
    startIndex + POSTS_PER_PAGE
  );

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading blogs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("blog.title")}</h1>
          <p className="text-muted-foreground">{t("blog.subtitle")}</p>
        </div>

        {/* Featured Posts Carousel */}
        {featuredPosts.length > 0 && (
          <section className="py-12 border-b">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                {t("blog.featured")} - Latest Posts
              </h2>
              <Carousel className="w-full max-w-5xl mx-auto">
                <CarouselContent>
                  {featuredPosts.map((post) => (
                    <CarouselItem key={post.id}>
                      <Link to={`/blog/${post.id}`}>
                        <Card className="overflow-hidden hover-scale transition-smooth">
                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="h-64 md:h-auto">
                              <img
                                src={post.image}
                                alt={post.title}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-6 flex flex-col justify-center">
                              {post.tags && post.tags.length > 0 && (
                                <Badge className="w-fit mb-3">
                                  {post.tags[0]}
                                </Badge>
                              )}
                              <h3 className="text-2xl font-bold mb-3">
                                {post.title}
                              </h3>
                              <p className="text-muted-foreground mb-4 line-clamp-3">
                                {post.excerpt}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  <span>{post.author}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  <span>{format(new Date(post.date), "MMM dd, yyyy")}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
          </section>
        )}

        {/* Search and Filters */}
        <section className="py-8 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="blog-search"
                    name="search"
                    type="text"
                    placeholder={t("blog.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Category Filters */}
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={
                      selectedCategory === category.id ? "default" : "outline"
                    }
                    onClick={() => handleCategoryChange(category.id)}
                    className="transition-smooth"
                  >
                    {category.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {paginatedPosts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                  {paginatedPosts.map((post) => (
                    <Link key={post.id} to={`/blog/${post.id}`}>
                      <Card className="h-full overflow-hidden hover-scale transition-smooth">
                        <div className="aspect-video overflow-hidden">
                          <img
                            src={post.image}
                            alt={post.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                          />
                        </div>
                        <CardHeader>
                          <div className="flex items-center justify-between mb-2">
                            {post.tags && post.tags.length > 0 && (
                              <Badge variant="secondary">
                                {post.tags[0]}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(post.date), "MMM dd, yyyy")}
                            </span>
                          </div>
                          <CardTitle className="text-xl line-clamp-2">
                            {post.title}
                          </CardTitle>
                          <CardDescription className="line-clamp-3">
                            {post.excerpt}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{post.author}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{format(new Date(post.date), "MMM dd")}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="icon"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        )
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  {t("blog.noPosts")}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
