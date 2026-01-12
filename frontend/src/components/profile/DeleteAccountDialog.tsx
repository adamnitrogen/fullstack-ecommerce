import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  userEmail: string;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  userEmail,
}: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [understood, setUnderstood] = useState(false);

  const handleConfirm = () => {
    if (confirmText === "DELETE" && understood) {
      onConfirm();
      setConfirmText("");
      setUnderstood(false);
    }
  };

  const handleCancel = () => {
    setConfirmText("");
    setUnderstood(false);
    onOpenChange(false);
  };

  const isValid = confirmText === "DELETE" && understood;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Delete Account Permanently
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-4">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">
                Warning: This action cannot be undone!
              </p>
              <p>
                Deleting your account will permanently remove all your data
                including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>Personal profile and login details</li>
                <li>Saved addresses and payment methods</li>
                <li>Shopping cart and wishlist items</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm">
                Your account email: <strong>{userEmail}</strong>
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="confirm-text">
                  Type <strong>DELETE</strong> to confirm
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="font-mono"
                />
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="understood"
                  checked={understood}
                  onCheckedChange={(checked) =>
                    setUnderstood(checked as boolean)
                  }
                />
                <Label
                  htmlFor="understood"
                  className="text-sm font-normal leading-tight cursor-pointer"
                >
                  I understand that this action is permanent and cannot be
                  reversed
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Delete Account Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
