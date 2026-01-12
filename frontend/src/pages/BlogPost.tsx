import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, User, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tag as TagComponent } from "@/components/ui/Tag";
import { Separator } from "@/components/ui/separator";

import { SocialShare } from "@/components/SocialShare";
import { useMetaTags } from "@/hooks/useMetaTags";
import { BlogComments } from "@/components/BlogComments";
import { blogService } from "@/services/blog.service";
import type { Blog } from "@/types";

export default function BlogPost() {
  const { postId } = useParams<{ postId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Fetch blog post from database
  const { data: post, isLoading } = useQuery({
    queryKey: ["blog", postId],
    queryFn: () => blogService.getById(postId || ""),
    enabled: !!postId,
  });

  // Fetch all blogs for related posts
  const { data: allBlogs = [] } = useQuery({
    queryKey: ["blogs"],
    queryFn: blogService.getAll,
  });

  // Update meta tags for social sharing
  useMetaTags({
    title: post?.title,
    description: post?.excerpt,
    image: post?.image,
    url: `/blog/${postId}`,
    type: "article",
    author: post?.author,
    publishedTime: post?.date ? new Date(post.date).toISOString() : undefined,
    tags: post?.tags,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading blog post...
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">{t("blog.notFound")}</h1>
          <Button onClick={() => navigate("/blog")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("blog.backToBlog")}
          </Button>
        </div>
      </div>
    );
  }

  // Get related posts from the same tags/category
  const relatedPosts = allBlogs
    .filter((blog) =>
      blog.id !== post.id &&
      blog.published &&
      blog.tags?.some(tag => post.tags?.includes(tag))
    )
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="relative h-[400px] w-full">
        <img
          src={post.image}
          alt={post.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-8 left-0 right-0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              {post.tags && post.tags.length > 0 && (
                <TagComponent variant="category" size="lg" className="mb-4">
                  {post.tags[0]}
                </TagComponent>
              )}  <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
                {post.title}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <Button
              variant="ghost"
              className="mb-6"
              onClick={() => navigate("/blog")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("blog.backToBlog")}
            </Button>

            {/* Article Meta */}
            <div className="flex flex-wrap items-center gap-4 mb-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span className="font-medium text-foreground">
                  {post.author}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(post.date), "MMMM dd, yyyy")}</span>
              </div>
            </div>

            {/* Article Excerpt */}
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              {post.excerpt}
            </p>

            <Separator className="my-8" />

            {/* Article Content */}
            <div
              className="prose prose-lg max-w-none
                prose-headings:font-bold prose-headings:text-foreground
                prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
                prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
                prose-strong:text-foreground
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            <div className="flex items-center gap-2 mt-12 pt-8 border-t">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <div className="flex flex-wrap gap-2">
                {post.tags?.map((tag, index) => (
                  <TagComponent key={index}>{tag}</TagComponent>
                ))}
              </div>
            </div>

            {/* Social Share */}
            <div className="mt-8 pt-8 border-t">
              <SocialShare
                url={`/blog/${postId}`}
                title={post.title}
                description={post.excerpt}
              />
            </div>

            {/* Comments Section */}
            <BlogComments blogId={postId || ""} />
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                {t("blog.relatedPosts")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost) => (
                  <Link key={relatedPost.id} to={`/blog/${relatedPost.id}`}>
                    <Card className="h-full overflow-hidden hover-scale transition-smooth">
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={relatedPost.image}
                          alt={relatedPost.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      </div>
                      <CardHeader>
                        {relatedPost.tags && relatedPost.tags.length > 0 && (
                          <TagComponent className="w-fit mb-2">
                            {relatedPost.tags[0]}
                          </TagComponent>
                        )}
                        <CardTitle className="text-lg line-clamp-2">
                          {relatedPost.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {relatedPost.excerpt}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(relatedPost.date), "MMM dd, yyyy")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
