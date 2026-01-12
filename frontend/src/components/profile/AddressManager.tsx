import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, Plus, Pencil, Trash2, Truck, CreditCard, Package } from "lucide-react";
import type { CheckoutAddress, CreateAddressDto } from "@/types";
import { useState } from "react";
import AddressFormModal from "./AddressFormModal";
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

interface AddressManagerProps {
    addresses: CheckoutAddress[];
    onAdd: (data: CreateAddressDto) => Promise<CheckoutAddress | void>;
    onUpdate: (id: string, data: CreateAddressDto) => Promise<CheckoutAddress | void>;
    onDelete: (id: string) => Promise<void>;
    onSetPrimary: (id: string) => Promise<CheckoutAddress | void>;
}

export default function AddressManager({
    addresses,
    onAdd,
    onUpdate,
    onDelete,
    onSetPrimary
}: AddressManagerProps) {
    const [showForm, setShowForm] = useState(false);
    const [editingAddress, setEditingAddress] = useState<CheckoutAddress | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'home':
                return <MapPin className="h-4 w-4" />;
            case 'work':
                return <CreditCard className="h-4 w-4" />;
            case 'other':
                return <Package className="h-4 w-4" />;
            case 'shipping':
                return <Truck className="h-4 w-4" />;
            case 'billing':
                return <CreditCard className="h-4 w-4" />;
            case 'both':
                return <Package className="h-4 w-4" />;
            default:
                return <MapPin className="h-4 w-4" />;
        }
    };

    const getAvailableTypes = (): Array<'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both'> => {
        // Allow all profile types
        return ['home', 'work', 'other'];
    };

    const handleEdit = (address: CheckoutAddress) => {
        setEditingAddress(address);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingAddress(null);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Addresses</CardTitle>
                            <CardDescription>
                                Manage your delivery and billing addresses
                            </CardDescription>
                        </div>
                        <Button onClick={() => setShowForm(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Address
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {addresses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <MapPin className="mx-auto h-12 w-12 mb-4 opacity-50" />
                            <p>No addresses added yet</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => setShowForm(true)}
                            >
                                Add Your First Address
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {addresses.map((address) => (
                                <div
                                    key={address.id}
                                    className={`border rounded-lg p-4 relative ${address.is_primary ? 'border-green-600 bg-green-50 dark:bg-green-950/20' : ''
                                        }`}
                                >
                                    {/* Action buttons in top-right corner */}
                                    <div className="absolute top-3 right-3 flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleEdit(address)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setDeletingId(address.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Address header with type */}
                                    <div className="flex items-center gap-2 mb-3 pr-20">
                                        {getTypeIcon(address.type)}
                                        <span className="font-semibold text-lg capitalize">
                                            {address.full_name}
                                        </span>
                                        {address.is_primary && (
                                            <Badge variant="default" className="text-xs">
                                                Primary
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="capitalize ml-auto mr-16">
                                            {address.type}
                                        </Badge>
                                    </div>

                                    {/* Address details */}
                                    <div className="text-sm space-y-1 mb-3">
                                        <p className="font-medium">{address.address_line1}</p>
                                        {address.address_line2 && <p className="text-muted-foreground">{address.address_line2}</p>}
                                        <p className="text-muted-foreground">
                                            {address.city}, {address.state} {address.postal_code}
                                        </p>
                                        <p className="text-muted-foreground">{address.country}</p>
                                        <p className="text-muted-foreground mt-1">Phone: {address.phone}</p>
                                    </div>

                                    {/* Set as primary button */}
                                    {!address.is_primary && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => onSetPrimary(address.id)}
                                        >
                                            <Star className="h-4 w-4" />
                                            Set as Primary
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddressFormModal
                open={showForm}
                onClose={handleCloseForm}
                onSave={editingAddress ? (data) => onUpdate(editingAddress.id, data) : onAdd}
                initialData={editingAddress || undefined}
                availableTypes={getAvailableTypes()}
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
                                    onDelete(deletingId);
                                    setDeletingId(null);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
