import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Download } from "lucide-react";
import { UserDialog } from "@/components/admin/UserDialog";
import { downloadCSV, flattenObject } from "@/lib/exportUtils";
import { toast } from "@/hooks/use-toast";
import { User } from "@/types";
import { useAuthStore } from "@/store/authStore";

export default function UsersManagement() {
  const [search, setSearch] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const { userService } = await import("@/services/user.service");

      // Get current logged-in admin from Zustand store
      const currentUser = useAuthStore.getState().user;
      const currentAdminId = currentUser?.id;

      // Get all users and filter to show only admins created by current admin
      const allUsers = await userService.getAll();
      return allUsers.filter(
        (user) => user.role === "admin" && user.createdBy === currentAdminId
      );
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddNewAdmin = () => {
    setUserDialogOpen(true);
  };

  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no admins to export.",
        variant: "destructive",
      });
      return;
    }

    const exportData = filteredUsers.map((user) =>
      flattenObject({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        addressCount: user.addresses?.length || 0,
      })
    );

    downloadCSV(exportData, "admins");
    toast({
      title: "Export successful",
      description: "Admins data has been downloaded.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Management</h1>
          <p className="text-muted-foreground">
            Manage admin users and their permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleAddNewAdmin}>
            <Plus className="h-4 w-4 mr-2" />
            Add Admin
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="user-search"
            name="search"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Addresses</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading admins...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No admins found. Add your first admin to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isDeleted = user.isDeleted ?? false;
                const isActive = user.isActive ?? true;

                // Determine status
                let statusText = "Active";
                let statusClass = "bg-green-500";
                let statusVariant: "default" | "secondary" | "destructive" =
                  "default";

                if (isDeleted) {
                  statusText = "Deleted";
                  statusClass = "bg-red-500";
                  statusVariant = "destructive";
                } else if (!isActive) {
                  statusText = "Inactive";
                  statusClass = "bg-gray-400";
                  statusVariant = "secondary";
                }

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || "-"}</TableCell>
                    <TableCell>{user.addresses.length} address(es)</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant} className={statusClass}>
                        {statusText}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <UserDialog open={userDialogOpen} onOpenChange={setUserDialogOpen} />
    </div>
  );
}
