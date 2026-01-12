import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Mail, Phone } from "lucide-react";
import { useState } from "react";
import ImageCropperModal from "./ImageCropperModal";

interface ProfileHeaderProps {
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    onAvatarUpdate: (file: File) => void;
    onAvatarDelete: () => void;
}

export default function ProfileHeader({
    name,
    email,
    phone,
    avatarUrl,
    onAvatarUpdate,
    onAvatarDelete
}: ProfileHeaderProps) {
    const [showCropper, setShowCropper] = useState(false);

    const getInitials = () => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <>
            <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border">
                <div className="relative">
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={avatarUrl} alt={name} />
                        <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
                    </Avatar>
                    <Button
                        size="icon"
                        className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                        onClick={() => setShowCropper(true)}
                    >
                        <Camera className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-1">{name}</h1>
                    <div className="flex flex-col gap-1 text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm">{email}</span>
                        </div>
                        {phone && (
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                <span className="text-sm">{phone}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ImageCropperModal
                open={showCropper}
                onClose={() => setShowCropper(false)}
                onSave={onAvatarUpdate}
                onDelete={avatarUrl ? onAvatarDelete : undefined}
            />
        </>
    );
}
