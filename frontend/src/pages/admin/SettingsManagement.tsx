import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Button } from '@/components/ui/button';
import { api, endpoints } from '@/lib/api';
import { toast } from 'sonner';
import { Truck, Tag } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorUtils';
import CouponsManagement from './CouponsManagement';

// Delivery Settings Schema
const deliverySchema = z.object({
  delivery_threshold: z.number().min(0, 'Threshold must be positive'),
  delivery_charge: z.number().min(0, 'Charge must be positive'),
  delivery_gst: z.number().min(0).max(28).default(0),
});

type DeliveryFormValues = z.infer<typeof deliverySchema>;

export default function SettingsManagement() {
  const [activeTab, setActiveTab] = useState('delivery');
  const queryClient = useQueryClient();

  // Fetch Delivery Settings
  const { data: deliverySettings, isLoading: isDeliveryLoading } = useQuery<DeliveryFormValues>({
    queryKey: ['deliverySettings'],
    queryFn: async () => {
      const response = await api.get(endpoints.getDeliverySettings);
      return response.data;
    },
  });

  // Defensive check for invalid API response (e.g. HTML error page)
  const safeSettings: Partial<DeliveryFormValues> = (deliverySettings && typeof deliverySettings === 'object')
    ? (deliverySettings as DeliveryFormValues)
    : {};

  // Delivery Form
  const deliveryForm = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    values: {
      delivery_threshold: safeSettings.delivery_threshold ?? 1500,
      delivery_charge: safeSettings.delivery_charge ?? 50,
      delivery_gst: safeSettings.delivery_gst ?? 0,
    },
  });

  // Update Delivery Settings Mutation
  const updateDeliveryMutation = useMutation({
    mutationFn: async (data: DeliveryFormValues) => {
      await api.patch(endpoints.updateDeliverySettings, {
        threshold: data.delivery_threshold,
        charge: data.delivery_charge,
        gst: data.delivery_gst,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverySettings'] });
      toast.success('Delivery settings updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to update delivery settings'));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Settings</h1>
        <p className="text-muted-foreground">Manage website configuration, delivery settings, and coupons</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
        </TabsList>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Delivery Settings
              </CardTitle>
              <CardDescription>
                Configure free delivery thresholds and charges
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isDeliveryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground animate-pulse">Loading delivery settings...</p>
                </div>
              ) : (
                <Form {...deliveryForm}>
                  <form
                    onSubmit={deliveryForm.handleSubmit((data) =>
                      updateDeliveryMutation.mutate(data)
                    )}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={deliveryForm.control}
                        name="delivery_threshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Free Delivery Threshold (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="1500"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                className="transition-all hover:border-primary/50 focus:border-primary"
                              />
                            </FormControl>
                            <FormDescription>
                              Orders above this amount will have free delivery.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={deliveryForm.control}
                        name="delivery_charge"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Charge (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="50"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                className="transition-all hover:border-primary/50 focus:border-primary"
                              />
                            </FormControl>
                            <FormDescription>
                              Base delivery amount.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={deliveryForm.control}
                        name="delivery_gst"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery GST (%)</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString() ?? "0"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select GST Rate" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[0, 5, 12, 18, 28].map((rate) => (
                                  <SelectItem key={rate} value={rate.toString()}>
                                    {rate}%
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Standard GST rate for delivery charges.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={updateDeliveryMutation.isPending}
                      className="w-full md:w-auto transition-transform hover:scale-105"
                    >
                      {updateDeliveryMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          {/* Wrapping CouponsManagement to handle layout internally if needed, or just render it */}
          {/* Since CouponsManagement has its own layout, we might want to just render it. 
               However, it has a page-level header. It might be better to just let it be for now. */}
          <CouponsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
