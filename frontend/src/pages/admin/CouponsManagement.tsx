import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Pencil,
    Trash2,
    Tag as TagIcon,
    Loader2,
    Filter,
} from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { Coupon } from "@/types";
import { couponService } from "@/services/coupon.service";
import { CouponDialog } from "../../components/admin/CouponDialog";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const CouponsManagement = () => {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [couponToDelete, setCouponToDelete] = useState<string | null>(null);

    // Filters
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const fetchCoupons = useCallback(async () => {
        try {
            setLoading(true);
            const filters: Record<string, unknown> = {};

            if (typeFilter !== "all") filters.type = typeFilter;
            if (statusFilter === "active") filters.is_active = true;
            if (statusFilter === "inactive") filters.is_active = false;
            if (statusFilter === "expired") filters.expired = true;

            const data = await couponService.getAll(filters);
            setCoupons(data);
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to load coupons"));
        } finally {
            setLoading(false);
        }
    }, [typeFilter, statusFilter]);

    useEffect(() => {
        fetchCoupons();
    }, [typeFilter, statusFilter, fetchCoupons]);

    const handleCreate = () => {
        setEditingCoupon(null);
        setDialogOpen(true);
    };

    const handleEdit = (coupon: Coupon) => {
        setEditingCoupon(coupon);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        await fetchCoupons();
        setDialogOpen(false);
        setEditingCoupon(null);
    };

    const handleDeleteClick = (id: string) => {
        setCouponToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!couponToDelete) return;

        try {
            await couponService.delete(couponToDelete);
            toast.success("Coupon deleted successfully");
            await fetchCoupons();
        } catch (error) {
            toast.error(getErrorMessage(error, "Failed to delete coupon"));
        } finally {
            setDeleteDialogOpen(false);
            setCouponToDelete(null);
        }
    };

    const isExpired = (validUntil: string) => {
        return new Date(validUntil) < new Date();
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Coupon
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div className="w-48">
                            <label htmlFor="type-filter" className="text-sm font-medium mb-2 block">Type</label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger id="type-filter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="cart">Cart-Level</SelectItem>
                                    <SelectItem value="category">Category-Level</SelectItem>
                                    <SelectItem value="product">Product-Level</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-48">
                            <label htmlFor="status-filter" className="text-sm font-medium mb-2 block">Status</label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger id="status-filter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Coupons Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Coupons ({coupons.length})</CardTitle>
                    <CardDescription>
                        View and manage all your discount coupons
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : coupons.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <TagIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No coupons found</p>
                            <Button variant="outline" className="mt-4" onClick={handleCreate}>
                                Create your first coupon
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Discount</TableHead>
                                        <TableHead>Valid Until</TableHead>
                                        <TableHead>Usage</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {coupons.map((coupon) => (
                                        <TableRow key={coupon.id}>
                                            <TableCell>
                                                <span className="font-mono font-semibold">
                                                    {coupon.code}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {coupon.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{coupon.discount_percentage}%</TableCell>
                                            <TableCell>
                                                <span
                                                    className={
                                                        isExpired(coupon.valid_until)
                                                            ? "text-destructive"
                                                            : ""
                                                    }
                                                >
                                                    {formatDate(coupon.valid_until)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {coupon.usage_count}
                                                {coupon.usage_limit && ` / ${coupon.usage_limit}`}
                                            </TableCell>
                                            <TableCell>
                                                {isExpired(coupon.valid_until) ? (
                                                    <Badge variant="destructive">Expired</Badge>
                                                ) : coupon.is_active ? (
                                                    <Badge className="bg-green-500">Active</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(coupon)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteClick(coupon.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Coupon Dialog */}
            <CouponDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                coupon={editingCoupon}
                onSave={handleSave}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this coupon? This will deactivate
                            it and users won't be able to use it anymore.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default CouponsManagement;
