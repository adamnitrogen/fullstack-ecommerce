import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Address } from "@/types";

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: Address | null;
  onSave: (address: Address) => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export function AddressDialog({
  open,
  onOpenChange,
  address,
  onSave,
}: AddressDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Address>>({
    name: "",
    phone: "",
    pincode: "",
    locality: "",
    addressLine: "",
    city: "",
    state: "",
    country: "India",
    landmark: "",
    alternatePhone: "",
    addressType: "home",
    type: "shipping",
  });

  useEffect(() => {
    if (address) {
      setFormData(address);
    } else {
      setFormData({
        name: "",
        phone: "",
        pincode: "",
        locality: "",
        addressLine: "",
        city: "",
        state: "",
        country: "India",
        landmark: "",
        alternatePhone: "",
        addressType: "home",
        type: "shipping",
      });
    }
  }, [address, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Address);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {address ? "Edit Address" : "Add New Address"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="10-digit mobile number"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode *</Label>
              <Input
                id="pincode"
                value={formData.pincode || ""}
                onChange={(e) =>
                  setFormData({ ...formData, pincode: e.target.value })
                }
                placeholder="6-digit pincode"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="locality">Locality *</Label>
              <Input
                id="locality"
                value={formData.locality || ""}
                onChange={(e) =>
                  setFormData({ ...formData, locality: e.target.value })
                }
                placeholder="Locality/Town"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine">Street Address *</Label>
            <Textarea
              id="addressLine"
              value={formData.addressLine || ""}
              onChange={(e) =>
                setFormData({ ...formData, addressLine: e.target.value })
              }
              placeholder="House No., Building Name, Road, Area"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City/District *</Label>
              <Input
                id="city"
                value={formData.city || ""}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="City/District"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Select
                value={formData.state || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, state: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="landmark">Landmark (Optional)</Label>
              <Input
                id="landmark"
                value={formData.landmark || ""}
                onChange={(e) =>
                  setFormData({ ...formData, landmark: e.target.value })
                }
                placeholder="Near famous place"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alternatePhone">Alternate Phone (Optional)</Label>
              <Input
                id="alternatePhone"
                type="tel"
                value={formData.alternatePhone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, alternatePhone: e.target.value })
                }
                placeholder="Alternate contact number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address Type *</Label>
            <RadioGroup
              value={formData.addressType || "home"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  addressType: value as "home" | "work",
                })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="home" id="home" />
                <Label htmlFor="home" className="font-normal">
                  Home
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="work" id="work" />
                <Label htmlFor="work" className="font-normal">
                  Work
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Address</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
