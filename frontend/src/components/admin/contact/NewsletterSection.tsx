import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { newsletterService, NewsletterSubscriber, NewsletterConfig } from "@/services/newsletter.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Send, Plus, Pencil, Trash2, Users, UserCheck, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NewsletterSubscriberDialog } from "./NewsletterSubscriberDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { getErrorMessage } from "@/lib/errorUtils";

export function NewsletterSection() {
  const [subscriberDialogOpen, setSubscriberDialogOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<NewsletterSubscriber | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string; email: string } | null>(null);
  const [configEdit, setConfigEdit] = useState(false);
  const [configData, setConfigData] = useState<NewsletterConfig | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subscribers
  const { data: subscribers = [], isLoading: subscribersLoading } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: () => newsletterService.getAllSubscribers(),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["newsletter-stats"],
    queryFn: () => newsletterService.getStats(),
  });

  // Fetch config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["newsletter-config"],
    queryFn: () => newsletterService.getConfig(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => newsletterService.deleteSubscriber(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
      toast({ title: "Subscriber deleted successfully" });
      setDeleteItem(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to delete subscriber",
        description: getErrorMessage(error, "Failed to delete subscriber"),
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      newsletterService.updateSubscriber(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
      toast({ title: "Subscriber status updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to update status",
        description: getErrorMessage(error, "Failed to update status"),
        variant: "destructive",
      });
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<NewsletterConfig>) => newsletterService.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-config"] });
      toast({ title: "Newsletter configuration updated successfully" });
      setConfigEdit(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to update configuration",
        description: getErrorMessage(error, "Failed to update configuration"),
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    if (!configData?.sender_name || !configData?.sender_email) {
      toast({
        title: "Error",
        description: "Sender name and email are required",
        variant: "destructive",
      });
      return;
    }
    updateConfigMutation.mutate(configData);
  };

  const handleEditConfig = () => {
    setConfigData(config || { sender_name: "", sender_email: "", footer_text: "" });
    setConfigEdit(true);
  };

  return (
    <>
      <NewsletterSubscriberDialog
        open={subscriberDialogOpen}
        onOpenChange={(open) => {
          setSubscriberDialogOpen(open);
          if (!open) setEditingSubscriber(null);
        }}
        subscriber={editingSubscriber}
      />

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
        title="Delete Subscriber"
        description={`Are you sure you want to delete ${deleteItem?.email}? This action cannot be undone.`}
      />

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.active || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats?.inactive || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Newsletter Configuration
                </CardTitle>
                <CardDescription>Manage newsletter sender details and footer text</CardDescription>
              </div>
              {!configEdit && (
                <Button onClick={handleEditConfig} variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {configEdit && configData ? (
              <>
                <div className="space-y-2">
                  <Label>
                    Sender Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={configData.sender_name}
                    onChange={(e) =>
                      setConfigData({ ...configData, sender_name: e.target.value })
                    }
                    placeholder="e.g., Gau Gyaan Newsletter"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Sender Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={configData.sender_email}
                    onChange={(e) =>
                      setConfigData({ ...configData, sender_email: e.target.value })
                    }
                    placeholder="newsletter@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Footer Text (Optional)</Label>
                  <Textarea
                    value={configData.footer_text || ""}
                    onChange={(e) =>
                      setConfigData({ ...configData, footer_text: e.target.value })
                    }
                    rows={3}
                    placeholder="This text will appear at the bottom of newsletter emails"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveConfig} disabled={updateConfigMutation.isPending}>
                    Save Configuration
                  </Button>
                  <Button variant="outline" onClick={() => setConfigEdit(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : config ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Sender Name</p>
                  <p className="font-medium">{config.sender_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sender Email</p>
                  <p className="font-medium">{config.sender_email}</p>
                </div>
                {config.footer_text && (
                  <div>
                    <p className="text-sm text-muted-foreground">Footer Text</p>
                    <p className="text-sm">{config.footer_text}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading configuration...</p>
            )}
          </CardContent>
        </Card>

        {/* Subscribers List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Newsletter Subscribers</CardTitle>
                <CardDescription>Manage your newsletter subscriber list</CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingSubscriber(null);
                  setSubscriberDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subscriber
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {subscribersLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading subscribers...</p>
            ) : subscribers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No subscribers yet. Add your first subscriber to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscribed Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className="font-medium">{subscriber.email}</TableCell>
                      <TableCell>{subscriber.name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={subscriber.is_active}
                            onCheckedChange={(checked) =>
                              toggleStatusMutation.mutate({
                                id: subscriber.id,
                                is_active: checked,
                              })
                            }
                          />
                          <Badge variant={subscriber.is_active ? "default" : "secondary"}>
                            {subscriber.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(subscriber.subscribed_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSubscriber(subscriber);
                              setSubscriberDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteItem({ id: subscriber.id, email: subscriber.email })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
