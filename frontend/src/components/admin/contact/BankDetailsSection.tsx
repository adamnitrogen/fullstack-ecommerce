import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, Save, X, QrCode, Building2, Upload, ToggleLeft, ToggleRight } from "lucide-react";
import { bankDetailsService, type BankDetails } from "@/services/bank-details.service";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";

interface BankDetailsSectionProps {
  bankDetails: BankDetails[];
  onRefresh: () => void;
}

export function BankDetailsSection({
  bankDetails,
  onRefresh,
}: BankDetailsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BankDetails>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newDetails, setNewDetails] = useState<Partial<BankDetails>>({
    type: "general",
  });
  const queryClient = useQueryClient();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<BankDetails>) => bankDetailsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast.success("Bank details added");
      setNewDetails({ type: "general" });
      setIsAdding(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to add bank details"));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BankDetails> }) =>
      bankDetailsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast.success("Bank details updated");
      setEditingId(null);
      setEditData({});
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update bank details"));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => bankDetailsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast.success("Bank details deleted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete bank details"));
    },
  });

  // Upload manual QR mutation
  const uploadQRMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      bankDetailsService.uploadManualQR(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast.success("QR code uploaded");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to upload QR code"));
    },
  });

  // Toggle QR mode mutation
  const toggleQRMutation = useMutation({
    mutationFn: ({ id, useManual }: { id: string; useManual: boolean }) =>
      bankDetailsService.toggleQRMode(id, useManual),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-details"] });
      toast.success("QR mode updated");
    },
  });

  const handleAdd = () => {
    // Trim whitespace from all string fields
    const trimmedDetails = {
      ...newDetails,
      account_name: newDetails.account_name?.trim(),
      account_number: newDetails.account_number?.trim(),
      ifsc_code: newDetails.ifsc_code?.trim(),
      bank_name: newDetails.bank_name?.trim(),
      branch_name: newDetails.branch_name?.trim(),
      upi_id: newDetails.upi_id?.trim(),
    };

    // Validate required fields with specific messages
    if (!trimmedDetails.account_name) {
      toast.error("Account Name is required");
      return;
    }
    if (!trimmedDetails.account_number) {
      toast.error("Account Number is required");
      return;
    }
    if (!trimmedDetails.ifsc_code) {
      toast.error("IFSC Code is required");
      return;
    }
    if (!trimmedDetails.bank_name) {
      toast.error("Bank Name is required");
      return;
    }
    if (!trimmedDetails.type) {
      toast.error("Account Type is required");
      return;
    }

    // Check if account type already exists
    const typeExists = bankDetails.some(
      (b) => b.type === trimmedDetails.type && b.is_active
    );

    if (typeExists) {
      toast.error(`A ${trimmedDetails.type} account already exists. Only one account per type is allowed.`);
      return;
    }

    createMutation.mutate(trimmedDetails);
  };

  const handleUpdate = (id: string) => {
    if (
      !editData.account_name ||
      !editData.account_number ||
      !editData.ifsc_code ||
      !editData.bank_name
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    updateMutation.mutate({ id, data: editData });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this bank account?")) {
      deleteMutation.mutate(id);
    }
  };

  const startEdit = (detail: BankDetails) => {
    setEditingId(detail.id);
    setEditData(detail);
  };

  const handleQRUpload = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      uploadQRMutation.mutate({ id, file });
    }
  };

  const getActiveQRUrl = (detail: BankDetails): string | undefined => {
    return bankDetailsService.getActiveQRUrl(detail);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bank Details & QR Codes
          </CardTitle>
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Bank Account
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-semibold">Add New Bank Details</h4>

            <div className="space-y-2">
              <Label>
                Account Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={newDetails.type}
                onValueChange={(value) =>
                  setNewDetails({
                    ...newDetails,
                    type: value as "general" | "donation",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="general"
                    disabled={bankDetails.some(b => b.type === 'general' && b.is_active)}
                  >
                    General (Footer) {bankDetails.some(b => b.type === 'general' && b.is_active) && '✓ Already exists'}
                  </SelectItem>
                  <SelectItem
                    value="donation"
                    disabled={bankDetails.some(b => b.type === 'donation' && b.is_active)}
                  >
                    Donation (Donate Page) {bankDetails.some(b => b.type === 'donation' && b.is_active) && '✓ Already exists'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {newDetails.type === "general"
                  ? "Will be displayed in footer with QR code"
                  : "Will be displayed on donation page with QR code"}
              </p>
              {bankDetails.some(b => b.type === newDetails.type && b.is_active) && (
                <p className="text-xs text-destructive">
                  ⚠️ A {newDetails.type} account already exists. Only one account per type is allowed.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Account Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.account_name || ""}
                  onChange={(e) =>
                    setNewDetails({
                      ...newDetails,
                      account_name: e.target.value,
                    })
                  }
                  placeholder="Account holder name"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Account Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.account_number || ""}
                  onChange={(e) =>
                    setNewDetails({
                      ...newDetails,
                      account_number: e.target.value,
                    })
                  }
                  placeholder="1234567890"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  IFSC Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.ifsc_code || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, ifsc_code: e.target.value })
                  }
                  placeholder="BANK0001234"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Bank Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newDetails.bank_name || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, bank_name: e.target.value })
                  }
                  placeholder="Bank name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch Name (Optional)</Label>
                <Input
                  value={newDetails.branch_name || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, branch_name: e.target.value })
                  }
                  placeholder="Branch name"
                />
              </div>
              <div className="space-y-2">
                <Label>UPI ID (Optional)</Label>
                <Input
                  value={newDetails.upi_id || ""}
                  onChange={(e) =>
                    setNewDetails({ ...newDetails, upi_id: e.target.value })
                  }
                  placeholder="example@upi"
                />
                <p className="text-xs text-muted-foreground">
                  If provided, UPI QR will be auto-generated
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm" disabled={createMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewDetails({ type: "general" });
                }}
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {bankDetails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No bank details added yet. Click "Add Bank Account" to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {bankDetails.map((detail) => (
              <div
                key={detail.id}
                className="border rounded-lg p-4 space-y-4 bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-8 w-8 text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{detail.account_name}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${detail.type === "donation"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                            }`}
                        >
                          {detail.type === "donation" ? "Donation" : "General"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {detail.bank_name}
                        {detail.branch_name && ` - ${detail.branch_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {editingId !== detail.id && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(detail)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(detail.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {editingId === detail.id ? (
                  <div className="space-y-4 pt-2 border-t">
                    {/* Edit form - similar to add form but with editData */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Account Name</Label>
                        <Input
                          value={editData.account_name || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              account_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number</Label>
                        <Input
                          value={editData.account_number || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              account_number: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>IFSC Code</Label>
                        <Input
                          value={editData.ifsc_code || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              ifsc_code: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bank Name</Label>
                        <Input
                          value={editData.bank_name || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              bank_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch Name</Label>
                        <Input
                          value={editData.branch_name || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              branch_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>UPI ID</Label>
                        <Input
                          value={editData.upi_id || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, upi_id: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => handleUpdate(detail.id)} size="sm" disabled={updateMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditData({});
                        }}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Account Number</p>
                        <p className="font-mono">{detail.account_number}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">IFSC Code</p>
                        <p className="font-mono">{detail.ifsc_code}</p>
                      </div>
                      {detail.upi_id && (
                        <div>
                          <p className="text-muted-foreground">UPI ID</p>
                          <p className="font-mono">{detail.upi_id}</p>
                        </div>
                      )}
                    </div>

                    {/* QR Code Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Label>QR Code</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {detail.use_manual_qr ? "Manual" : "Auto-generated"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleQRMutation.mutate({
                                id: detail.id,
                                useManual: !detail.use_manual_qr,
                              })
                            }
                            disabled={!detail.qr_code_manual_url}
                          >
                            {detail.use_manual_qr ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        {getActiveQRUrl(detail) && (
                          <div>
                            <img
                              src={getActiveQRUrl(detail)}
                              alt="Payment QR Code"
                              className="w-32 h-32 border rounded"
                            />
                          </div>
                        )}

                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`qr-upload-${detail.id}`} className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                              <span>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Manual QR
                              </span>
                            </Button>
                          </Label>
                          <input
                            id={`qr-upload-${detail.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleQRUpload(detail.id, e)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Auto QR generated from {detail.upi_id ? "UPI ID" : "bank details"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
