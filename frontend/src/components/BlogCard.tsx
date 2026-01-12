import { Link } from 'react-router-dom';
import { Calendar, User } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Blog } from '@/types';

interface BlogCardProps {
  blog: Blog;
}

export const BlogCard = ({ blog }: BlogCardProps) => {
  return (
    <Card className="hover:shadow-elevated transition-all duration-300 h-full flex flex-col">
      {blog.image && (
        <div className="overflow-hidden rounded-t-lg">
          <img
            src={blog.image}
            alt={blog.title}
            loading="lazy"
            className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <CardHeader>
        <h3 className="font-semibold text-lg line-clamp-2 hover:text-primary transition-smooth">
          {blog.title}
        </h3>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>{blog.author}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{new Date(blog.date).toLocaleDateString()}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {blog.excerpt}
        </p>
      </CardContent>

      <CardFooter>
        <Link to={`/blog/${blog.id}`} className="w-full">
          <Button variant="outline" className="w-full">
            Read More
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
