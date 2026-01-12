import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AddressFormModal from "@/components/profile/AddressFormModal";
import { addressService } from "@/services/address.service";
import type { CheckoutAddress, CreateAddressDto } from "@/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AddressSelectorProps {
    type: 'shipping' | 'billing';
    selectedAddressId?: string;
    onSelect: (address: CheckoutAddress) => void;
}

export function AddressSelector({ type, selectedAddressId, onSelect }: AddressSelectorProps) {
    const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingAddress, setEditingAddress] = useState<CheckoutAddress | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchAddresses();
    }, [type]);

    const fetchAddresses = async () => {
        try {
            setLoading(true);
            const data = await addressService.getAddresses();

            // For checkout, show ALL addresses regardless of backend type
            // User can use any address for shipping or billing
            let filtered = data;

            // Also ensure selected address is included if it exists
            if (selectedAddressId) {
                const selectedExists = filtered.find(a => a.id === selectedAddressId);
                if (!selectedExists) {
                    const selectedInData = data.find(a => a.id === selectedAddressId);
                    if (selectedInData) {
                        filtered = [...filtered, selectedInData];
                    }
                }
            }

            setAddresses(filtered);

            // Auto-select primary address
            const primary = filtered.find((addr) => addr.is_primary);
            if (primary && !selectedAddressId) {
                onSelect(primary);
            }
        } catch (error: unknown) {
            logger.error("Address fetch error:", error);
            toast.error(getErrorMessage(error, "Failed to load addresses"));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (data: CreateAddressDto) => {
        try {
            setSaving(true);
            let newAddress;
            if (editingAddress) {
                newAddress = await addressService.updateAddress(editingAddress.id, data);
                toast.success("Address updated successfully");
            } else {
                newAddress = await addressService.createAddress(data);
                toast.success("Address added successfully");
            }
            await fetchAddresses();
            onSelect(newAddress);
            handleCloseDialog();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, editingAddress ? "Failed to update address" : "Failed to add address"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await addressService.deleteAddress(id);
            toast.success("Address deleted successfully");

            // If deleted address was selected, clear selection or select another
            if (selectedAddressId === id) {
                const remaining = addresses.filter(a => a.id !== id);
                if (remaining.length > 0) {
                    onSelect(remaining[0]);
                }
            }

            await fetchAddresses();
        } catch (error) {
            toast.error("Failed to delete address");
        } finally {
            setDeletingId(null);
        }
    };

    const handleEdit = (address: CheckoutAddress, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the address when clicking edit
        setEditingAddress(address);
        setDialogOpen(true);
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the address when clicking delete
        setDeletingId(id);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingAddress(null);
    };

    if (loading) {
        return <div className="text-center py-8">Loading addresses...</div>;
    }

    return (
        <div className="space-y-4">
            <RadioGroup value={selectedAddressId} onValueChange={(id) => {
                const addr = addresses.find(a => a.id === id);
                if (addr) onSelect(addr);
            }}>
                <div className="grid gap-3">
                    {addresses.map((address) => (
                        <Card key={address.id} className={`relative ${selectedAddressId === address.id ? "border-primary" : ""}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <RadioGroupItem value={address.id} id={`${type}-${address.id}`} className="mt-1" />
                                    <div className="flex-1">
                                        <Label htmlFor={`${type}-${address.id}`} className="cursor-pointer block">
                                            <div className="flex items-center gap-2 mb-2">
                                                <MapPin className="h-4 w-4" />
                                                <span className="font-semibold">{address.full_name}</span>
                                                {address.is_primary && (
                                                    <Badge variant="default" className="text-xs">Primary</Badge>
                                                )}
                                                <Badge variant="outline" className="text-xs capitalize">{address.type}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {address.address_line1}
                                                {address.address_line2 && `, ${address.address_line2}`}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {address.city}, {address.state} - {address.postal_code}
                                            </p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Phone: {address.phone}
                                            </p>
                                        </Label>
                                    </div>

                                    {/* Edit/Delete Actions */}
                                    <div className="flex flex-col gap-2 ml-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={(e) => handleEdit(address, e)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={(e) => handleDeleteClick(address.id, e)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setDialogOpen(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New {type === 'shipping' ? 'Shipping' : 'Billing'} Address
                    </Button>
                </div>
            </RadioGroup>

            <AddressFormModal
                open={dialogOpen}
                onClose={handleCloseDialog}
                onSave={handleSubmit}
                initialData={editingAddress || undefined}
                availableTypes={['home', 'work', 'other']}
            />

            <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Address</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this address? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deletingId) {
                                    handleDelete(deletingId);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
