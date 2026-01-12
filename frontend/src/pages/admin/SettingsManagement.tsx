import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api, endpoints } from '@/lib/api';
import { toast } from 'sonner';
import { Facebook, Instagram, Youtube, Mail, Phone, MapPin, Settings } from 'lucide-react';
import { PhoneInput } from "@/components/ui/phone-input";
import { getErrorMessage } from '@/lib/errorUtils';

// Social Media Settings Schema
const socialMediaSchema = z.object({
  facebook: z.string().url('Invalid URL').optional().or(z.literal('')),
  instagram: z.string().url('Invalid URL').optional().or(z.literal('')),
  youtube: z.string().url('Invalid URL').optional().or(z.literal('')),
  twitter: z.string().url('Invalid URL').optional().or(z.literal('')),
});

// Contact Information Schema
const contactInfoSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipcode: z.string().min(1, 'Zipcode is required'),
});

// Newsletter Settings Schema
const newsletterSchema = z.object({
  senderName: z.string().min(1, 'Sender name is required'),
  senderEmail: z.string().email('Invalid email address'),
  replyToEmail: z.string().email('Invalid email address'),
  footerText: z.string().optional(),
});

type SocialMediaFormValues = z.infer<typeof socialMediaSchema>;
type ContactInfoFormValues = z.infer<typeof contactInfoSchema>;
type NewsletterFormValues = z.infer<typeof newsletterSchema>;

interface Settings {
  socialMedia: SocialMediaFormValues;
  contactInfo: ContactInfoFormValues;
  newsletter: NewsletterFormValues;
}

export default function SettingsManagement() {
  const [activeTab, setActiveTab] = useState('social');
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get(endpoints.getSettings);
      return response.data;
    },
  });

  // Social Media Form
  const socialMediaForm = useForm<SocialMediaFormValues>({
    resolver: zodResolver(socialMediaSchema),
    values: settings?.socialMedia || {
      facebook: '',
      instagram: '',
      youtube: '',
      twitter: '',
    },
  });

  // Contact Info Form
  const contactInfoForm = useForm<ContactInfoFormValues>({
    resolver: zodResolver(contactInfoSchema),
    values: settings?.contactInfo || {
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipcode: '',
    },
  });

  // Newsletter Form
  const newsletterForm = useForm<NewsletterFormValues>({
    resolver: zodResolver(newsletterSchema),
    values: settings?.newsletter || {
      senderName: '',
      senderEmail: '',
      replyToEmail: '',
      footerText: '',
    },
  });

  // Update Social Media Mutation
  const updateSocialMediaMutation = useMutation({
    mutationFn: async (data: SocialMediaFormValues) => {
      await api.put(endpoints.updateSettings, { socialMedia: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Social media links updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to update social media links'));
    },
  });

  // Update Contact Info Mutation
  const updateContactInfoMutation = useMutation({
    mutationFn: async (data: ContactInfoFormValues) => {
      await api.put(endpoints.updateSettings, { contactInfo: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Contact information updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to update contact information'));
    },
  });

  // Update Newsletter Mutation
  const updateNewsletterMutation = useMutation({
    mutationFn: async (data: NewsletterFormValues) => {
      await api.put(endpoints.updateSettings, { newsletter: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Newsletter settings updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to update newsletter settings'));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage website configuration and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="contact">Contact Info</TabsTrigger>
          <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
        </TabsList>

        {/* Social Media Tab */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Social Media Links
              </CardTitle>
              <CardDescription>
                Manage your social media presence and links displayed on the website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...socialMediaForm}>
                <form
                  onSubmit={socialMediaForm.handleSubmit((data) =>
                    updateSocialMediaMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <FormField
                    control={socialMediaForm.control}
                    name="facebook"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Facebook className="h-4 w-4" />
                          Facebook
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="facebook-url"
                            placeholder="https://facebook.com/yourpage"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={socialMediaForm.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Instagram className="h-4 w-4" />
                          Instagram
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="instagram-url"
                            placeholder="https://instagram.com/yourprofile"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={socialMediaForm.control}
                    name="youtube"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Youtube className="h-4 w-4" />
                          YouTube
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="youtube-url"
                            placeholder="https://youtube.com/yourchannel"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={socialMediaForm.control}
                    name="twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                          Twitter/X
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="twitter-url"
                            placeholder="https://twitter.com/yourhandle"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={updateSocialMediaMutation.isPending}
                  >
                    {updateSocialMediaMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Information Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Update business contact details displayed on the website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...contactInfoForm}>
                <form
                  onSubmit={contactInfoForm.handleSubmit((data) =>
                    updateContactInfoMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={contactInfoForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              id="contact-email"
                              type="email"
                              placeholder="contact@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contactInfoForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            label="Phone"
                            placeholder="+91 1234567890"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={contactInfoForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Street Address
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            id="contact-address"
                            placeholder="123 Main Street"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={contactInfoForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input id="contact-city" placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contactInfoForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input id="contact-state" placeholder="State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contactInfoForm.control}
                      name="zipcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zipcode</FormLabel>
                          <FormControl>
                            <Input id="contact-zipcode" placeholder="123456" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={updateContactInfoMutation.isPending}
                  >
                    {updateContactInfoMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Newsletter Tab */}
        <TabsContent value="newsletter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Newsletter Configuration
              </CardTitle>
              <CardDescription>
                Configure newsletter sender information and default settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...newsletterForm}>
                <form
                  onSubmit={newsletterForm.handleSubmit((data) =>
                    updateNewsletterMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <FormField
                    control={newsletterForm.control}
                    name="senderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sender Name</FormLabel>
                        <FormControl>
                          <Input id="newsletter-sender-name" placeholder="Your Organization Name" {...field} />
                        </FormControl>
                        <FormDescription>
                          Name displayed as the sender of newsletter emails
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newsletterForm.control}
                    name="senderEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sender Email</FormLabel>
                        <FormControl>
                          <Input
                            id="newsletter-sender-email"
                            type="email"
                            placeholder="newsletter@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Email address used to send newsletters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newsletterForm.control}
                    name="replyToEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reply-To Email</FormLabel>
                        <FormControl>
                          <Input
                            id="newsletter-reply-to"
                            type="email"
                            placeholder="support@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Email address where replies will be sent
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newsletterForm.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer Text (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            id="newsletter-footer"
                            placeholder="Add custom footer text for newsletters..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Additional text to include at the bottom of newsletters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={updateNewsletterMutation.isPending}
                  >
                    {updateNewsletterMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
