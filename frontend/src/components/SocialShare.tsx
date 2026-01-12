import { Facebook, Twitter, Linkedin, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  className?: string;
}

export function SocialShare({ url, title, description, className = '' }: SocialShareProps) {
  const { toast } = useToast();
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || '');

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
  };

  const handleShare = (platform: string, link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer,width=600,height=600');
    toast({
      title: 'Opening share dialog',
      description: `Sharing on ${platform}...`,
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({
        title: 'Link copied!',
        description: 'The link has been copied to your clipboard.',
      });
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-medium text-foreground">Share this article</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('Facebook', shareLinks.facebook)}
          className="gap-2"
        >
          <Facebook className="h-4 w-4" />
          <span className="hidden sm:inline">Facebook</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('Twitter', shareLinks.twitter)}
          className="gap-2"
        >
          <Twitter className="h-4 w-4" />
          <span className="hidden sm:inline">Twitter</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('LinkedIn', shareLinks.linkedin)}
          className="gap-2"
        >
          <Linkedin className="h-4 w-4" />
          <span className="hidden sm:inline">LinkedIn</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('WhatsApp', shareLinks.whatsapp)}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={copyToClipboard}
          className="gap-2"
        >
          Copy Link
        </Button>
      </div>
    </div>
  );
}
