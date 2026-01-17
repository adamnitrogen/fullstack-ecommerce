import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { deliveryConfigService } from "@/services/delivery-config.service";
import { DeliveryConfig } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DeliveryConfigFormProps {
    productId: string;
    variantId?: string | null;
}

export function DeliveryConfigForm({ productId, variantId = null }: DeliveryConfigFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<Partial<DeliveryConfig>>({
        calculation_type: "PER_ITEM",
        base_delivery_charge: 0,
        gst_percentage: 18,
        delivery_refund_policy: "NON_REFUNDABLE",
        is_active: true,
    });

    // Fetch existing config
    const { data: existingConfig, isLoading } = useQuery({
        queryKey: ["delivery-config", productId, variantId],
        queryFn: async () => {
            // Currently we only support product-level config via this form
            // Variant support can be added later if needed
            if (variantId) return null;
            const data = await deliveryConfigService.getByProduct(productId);
            return data || null;
        },
        enabled: !!productId,
    });

    useEffect(() => {
        if (existingConfig) {
            setFormData({
                ...existingConfig,
                // Ensure defaults if fields are missing
                gst_percentage: existingConfig.gst_percentage ?? 18,
                delivery_refund_policy: existingConfig.delivery_refund_policy ?? "NON_REFUNDABLE",
            });
        }
    }, [existingConfig]);

    const mutation = useMutation({
        mutationFn: async (data: Partial<DeliveryConfig>) => {
            if (existingConfig?.id) {
                return deliveryConfigService.update(existingConfig.id, data);
            } else {
                return deliveryConfigService.create({
                    ...data,
                    product_id: productId,
                    variant_id: variantId,
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["delivery-config", productId] });
            toast.success("Delivery configuration saved successfully");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to save configuration");
        },
    });

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        mutation.mutate(formData);
    };

    if (isLoading) {
        return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg">Delivery Configuration</CardTitle>
                <CardDescription>
                    Configure specific delivery rules for this product. These settings override global defaults.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
                <div className="space-y-4">

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/20">
                        <div className="space-y-0.5">
                            <Label className="text-base">Enable Custom Delivery Rules</Label>
                            <p className="text-xs text-muted-foreground">
                                If disabled, standard global delivery rules will apply.
                            </p>
                        </div>
                        <Switch
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                    </div>

                    {formData.is_active && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">

                            {/* Calculation Type */}
                            <div className="space-y-2">
                                <Label>Calculation Method</Label>
                                <Select
                                    value={formData.calculation_type}
                                    onValueChange={(val: any) => setFormData({ ...formData, calculation_type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PER_ITEM">Per Item (Charge × Quantity)</SelectItem>
                                        <SelectItem value="FLAT_PER_ORDER">Flat Rate (Once per order containing this item)</SelectItem>
                                        <SelectItem value="PER_PACKAGE">Per Package (Standard)</SelectItem>
                                        {/* Weight based hidden for now as it requires complex UI */}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    How the delivery fee is calculated when this product is in the cart.
                                </p>
                            </div>

                            {/* Base Charge */}
                            <div className="space-y-2">
                                <Label>Delivery Charge (₹)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.base_delivery_charge}
                                    onChange={(e) => setFormData({ ...formData, base_delivery_charge: parseFloat(e.target.value) || 0 })}
                                />
                            </div>

                            {/* GST */}
                            <div className="space-y-2">
                                <Label>GST Rate (%)</Label>
                                <Select
                                    value={formData.gst_percentage?.toString()}
                                    onValueChange={(val) => setFormData({ ...formData, gst_percentage: parseFloat(val) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select GST" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">0% (Exempt)</SelectItem>
                                        <SelectItem value="5">5%</SelectItem>
                                        <SelectItem value="12">12%</SelectItem>
                                        <SelectItem value="18">18% (Standard Service)</SelectItem>
                                        <SelectItem value="28">28%</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    GST applied on the delivery service itself (SAC 996812).
                                </p>
                            </div>

                            {/* Refund Policy */}
                            <div className="space-y-2">
                                <Label>Refund Policy</Label>
                                <Select
                                    value={formData.delivery_refund_policy}
                                    onValueChange={(val: any) => setFormData({ ...formData, delivery_refund_policy: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Policy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NON_REFUNDABLE">Non-Refundable (Standard)</SelectItem>
                                        <SelectItem value="REFUNDABLE">Refundable</SelectItem>
                                    </SelectContent>
                                </Select>

                                {formData.delivery_refund_policy === 'NON_REFUNDABLE' ? (
                                    <Alert className="bg-orange-50 border-orange-200 py-2">
                                        <Info className="h-4 w-4 text-orange-600" />
                                        <AlertTitle className="text-xs font-bold text-orange-800">Policy Note</AlertTitle>
                                        <AlertDescription className="text-xs text-orange-700">
                                            Delivery charges will NOT be refunded if the customer returns this item.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert className="bg-blue-50 border-blue-200 py-2">
                                        <Info className="h-4 w-4 text-blue-600" />
                                        <AlertTitle className="text-xs font-bold text-blue-800">Policy Note</AlertTitle>
                                        <AlertDescription className="text-xs text-blue-700">
                                            Delivery charges will be refunded if the customer returns this item.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>

                        </div>
                    )}

                    <Button type="button" onClick={() => handleSubmit()} disabled={mutation.isPending} className="w-full">
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Configuration
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
