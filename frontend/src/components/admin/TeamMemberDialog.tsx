import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import { TeamMember } from "@/types";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileImageCropper } from "./ProfileImageCropper";

interface TeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamMember | null;
}

export default function TeamMemberDialog({
  open,
  onOpenChange,
  member,
}: TeamMemberDialogProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState<string | File>("");
  const [originalImageUrl, setOriginalImageUrl] = useState<string>("");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (member) {
      setName(member.name);
      setRole(member.role);
      setBio(member.bio);
      setImage(member.image);
      setOriginalImageUrl(member.image); // Store original URL
      setOrder(member.order);
    } else {
      setName("");
      setRole("");
      setBio("");
      setImage("");
      setOriginalImageUrl("");
      setOrder(1);
    }
  }, [member, open]);

  const addMutation = useMutation({
    mutationFn: async (newMember: Omit<TeamMember, "id"> & { imageFile?: File }) => {
      const formData = new FormData();
      const { imageFile, ...rest } = newMember;

      formData.append("data", JSON.stringify(rest));
      if (imageFile) {
        formData.append("image", imageFile);
      }

      return aboutService.createTeamMember(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Team member added successfully" });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<TeamMember, "id">> & { imageFile?: File };
    }) => {
      const formData = new FormData();
      const { imageFile, ...rest } = updates;

      formData.append("data", JSON.stringify(rest));
      if (imageFile) {
        formData.append("image", imageFile);
      }

      return aboutService.updateTeamMember(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: "Team member updated successfully" });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !role.trim() || !bio.trim() || !image) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Determine if we have a new file or should use existing URL
    const imageFile = image instanceof File ? image : undefined;
    const imageUrl = imageFile ? "" : (typeof image === 'string' ? image : originalImageUrl);

    const memberData = {
      name: name.trim(),
      role: role.trim(),
      bio: bio.trim(),
      image: imageUrl,
      order,
      imageFile,
    };

    if (member) {
      updateMutation.mutate({ id: member.id, updates: memberData });
    } else {
      addMutation.mutate(memberData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {member ? "Edit Team Member" : "Add New Team Member"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">Member Details</h3>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Dr. Rajesh Kumar"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Founder & CEO"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">
                  Bio <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Enter team member bio..."
                  rows={3}
                  required
                />
              </div>
            </div>

            {/* Photo & Display */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">
                Photo & Display Settings
              </h3>

              <div className="space-y-2">
                <Label htmlFor="image">
                  Profile Photo <span className="text-destructive">*</span>
                </Label>
                <ProfileImageCropper
                  image={image}
                  onChange={(file) => setImage(file)}
                  onClear={() => setImage("")}
                />
                <p className="text-sm text-muted-foreground">
                  Upload a professional photo. You can crop and adjust the image to focus on the face.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order">Display Order</Label>
                <Input
                  id="order"
                  type="number"
                  min="1"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending || updateMutation.isPending}
              >
                {member ? "Update" : "Add"} Team Member
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
