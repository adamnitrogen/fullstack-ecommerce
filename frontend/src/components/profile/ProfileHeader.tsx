import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Mail, Phone, ShieldCheck, Heart } from "lucide-react";
import { useState } from "react";
import ImageCropperModal from "./ImageCropperModal";

interface ProfileHeaderProps {
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    isEmailVerified?: boolean;
    onAvatarUpdate: (file: File) => void;
    onAvatarDelete: () => void;
}

export default function ProfileHeader({
    name,
    email,
    phone,
    avatarUrl,
    isEmailVerified,
    onAvatarUpdate,
    onAvatarDelete
}: ProfileHeaderProps) {
    const [showCropper, setShowCropper] = useState(false);

    const getInitials = () => {
        return name
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <>
            <div className="relative overflow-hidden rounded-[2.5rem] bg-white shadow-elevated border border-border/40 group">
                {/* Banner Background */}
                <div className="h-28 md:h-36 w-full bg-[#2C1810] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#B85C3C] via-transparent to-transparent"></div>
                    <div className="absolute -right-10 -bottom-10 h-40 w-40 bg-[#B85C3C] rounded-full blur-[80px] opacity-20"></div>
                </div>

                {/* Profile Content */}
                <div className="px-6 pb-8 -mt-12 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end gap-6">
                        {/* Avatar Section */}
                        <div className="relative group/avatar">
                            <div className="p-1 px-1 bg-white rounded-full inline-block shadow-lg">
                                <Avatar className="h-28 w-28 md:h-32 md:h-32 border-4 border-[#FDFBF9] shadow-inner">
                                    <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                                    <AvatarFallback className="text-3xl font-playfair bg-[#FDFBF9] text-[#2C1810]">
                                        {getInitials()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <Button
                                size="icon"
                                className="absolute bottom-1 right-1 h-10 w-10 rounded-full bg-[#B85C3C] hover:bg-[#2C1810] text-white border-2 border-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                                onClick={() => setShowCropper(true)}
                            >
                                <Camera className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* User Info Section */}
                        <div className="flex-1 space-y-3 pb-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl md:text-3xl font-bold font-playfair text-[#2C1810]">
                                    {name}
                                </h1>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
                                <div className="flex items-center gap-2 group/info cursor-pointer transition-colors">
                                    <div className="p-1.5 bg-muted rounded-lg group-hover/info:bg-[#B85C3C]/10 transition-colors">
                                        <Mail className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium group-hover/info:text-[#B85C3C] transition-colors">{email}</span>
                                        {isEmailVerified && (
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-wider border border-emerald-100">
                                                <ShieldCheck className="h-2.5 w-2.5" /> Verified
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {phone && (
                                    <div className="flex items-center gap-2 group/info cursor-pointer hover:text-[#B85C3C] transition-colors">
                                        <div className="p-1.5 bg-muted rounded-lg group-hover/info:bg-[#B85C3C]/10 transition-colors">
                                            <Phone className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="text-sm font-medium">{phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>
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
