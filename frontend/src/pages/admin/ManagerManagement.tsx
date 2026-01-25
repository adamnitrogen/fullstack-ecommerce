import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { managerService, Manager } from "@/services/manager.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { ManagerDialog } from "@/components/admin/ManagerDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";

export default function ManagerManagement() {
    const [managerDialogOpen, setManagerDialogOpen] = useState(false);
    const [editingManager, setEditingManager] = useState<Manager | null>(null);
    const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch managers
    const { data: managers = [], isLoading } = useQuery({
        queryKey: ["managers"],
        queryFn: () => managerService.getAll(),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => managerService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            toast({ title: "Manager deleted successfully" });
            setDeleteItem(null);
        },
        onError: (error: unknown) => {
            toast({
                title: "Failed to delete manager",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    // Toggle status mutation
    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
            managerService.toggleStatus(id, is_active),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            toast({ title: "Manager status updated" });
        },
        onError: (error: unknown) => {
            toast({
                title: "Failed to update status",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const getPermissions = (manager: Manager) => {
        if (!manager.manager_permissions) return null;
        if (Array.isArray(manager.manager_permissions)) {
            return manager.manager_permissions[0] || null;
        }
        return manager.manager_permissions;
    };

    const getActivePermissionsCount = (manager: Manager) => {
        const perms = getPermissions(manager);
        if (!perms) return 0;
        return Object.entries(perms).filter(
            ([key, value]) => key.startsWith("can_manage_") && value === true
        ).length;
    };

    return (
        <>
            <ManagerDialog
                open={managerDialogOpen}
                onOpenChange={(open) => {
                    setManagerDialogOpen(open);
                    if (!open) setEditingManager(null);
                }}
                manager={editingManager}
            />

            <DeleteConfirmDialog
                open={!!deleteItem}
                onOpenChange={(open) => !open && setDeleteItem(null)}
                onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
                title="Delete Manager"
                description={`Are you sure you want to delete ${deleteItem?.name}? This will permanently remove their account and they will no longer be able to access the portal.`}
            />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Manager Management</h1>
                    <p className="text-muted-foreground">
                        Create and manage manager accounts with specific permissions
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Managers
                                </CardTitle>
                                <CardDescription>Total: {managers.length} manager(s)</CardDescription>
                            </div>
                            <Button
                                onClick={() => {
                                    setEditingManager(null);
                                    setManagerDialogOpen(true);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Manager
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p className="text-center text-muted-foreground py-8">Loading managers...</p>
                        ) : managers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No managers yet. Create your first manager to get started.
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Created By</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {managers.map((manager) => {
                                        const permissions = getPermissions(manager);
                                        const hasPermissions = !!permissions;
                                        const isActive = permissions ? permissions.is_active : false;

                                        return (
                                            <TableRow key={manager.id}>
                                                <TableCell className="font-medium">{manager.name}</TableCell>
                                                <TableCell>{manager.email}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="font-normal">
                                                            {manager.creator_name || 'System'}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {getActivePermissionsCount(manager)} of 18
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={isActive}
                                                            disabled={!hasPermissions}
                                                            onCheckedChange={(checked) =>
                                                                toggleStatusMutation.mutate({
                                                                    id: manager.id,
                                                                    is_active: checked,
                                                                })
                                                            }
                                                        />
                                                        <Badge
                                                            variant={isActive ? "default" : "secondary"}
                                                        >
                                                            {isActive ? "Active" : "Inactive"}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(manager.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setEditingManager(manager);
                                                                setManagerDialogOpen(true);
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                setDeleteItem({ id: manager.id, name: manager.name })
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
