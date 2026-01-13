import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { policyService, PolicyType } from "@/services/policy.service";
import { PolicyPreviewDialog } from "@/components/admin/PolicyPreviewDialog";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function PolicyManagement() {
    const [selectedPolicy, setSelectedPolicy] = useState<PolicyType>("privacy");
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetFileInput = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Fetch current policy version
    const { data: currentPolicy, refetch } = useQuery({
        queryKey: ["policy", selectedPolicy],
        queryFn: async () => {
            try {
                return await policyService.getPublic(selectedPolicy);
            } catch (error) {
                return null;
            }
        },
        retry: false,
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            return await policyService.upload(file, selectedPolicy);
        },
        onSuccess: async (data: any) => {
            toast.success(`${selectedPolicy} policy uploaded successfully!`);

            // Handle potential field naming discrepancies (snake_case vs camelCase)
            const content = data.contentHtml || data.content_html;
            setPreviewContent(content);

            resetFileInput();

            // Clear cache for this policy type to ensure fresh data on next fetch
            localStorage.removeItem(`policy_${selectedPolicy}`);

            refetch();

            // Simulate rendering delay for a smoother experience
            setIsRendering(true);
            setTimeout(() => {
                setIsRendering(false);
                setIsPreviewOpen(true);
            }, 1000);
        },
        onError: (error: any) => {
            console.error(error);
            toast.error(error.response?.data?.error || error.message || "Failed to upload policy");
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const validTypes = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ];

            if (!validTypes.includes(file.type)) {
                toast.error("Invalid file type. Please upload PDF, DOC, or DOCX.");
                return;
            }

            setSelectedFile(file);
        }
    };

    const handleUpload = () => {
        if (!selectedFile) return;
        uploadMutation.mutate(selectedFile);
    };

    const handlePreview = () => {
        if (currentPolicy) {
            setPreviewContent(currentPolicy.contentHtml);

            // Simulate rendering delay for a smoother experience
            setIsRendering(true);
            setTimeout(() => {
                setIsRendering(false);
                setIsPreviewOpen(true);
            }, 800);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <LoadingOverlay isLoading={isRendering} message="Preparing preview..." />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Policy Management</h1>
                <p className="text-muted-foreground">
                    Manage website policies (Privacy, Terms, Shipping, Refund).
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Policy Document</CardTitle>
                        <CardDescription>
                            Select the policy type and upload a PDF/DOC/DOCX file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Policy Type</label>
                            <Select
                                value={selectedPolicy}
                                onValueChange={(value: PolicyType) => {
                                    setSelectedPolicy(value);
                                    setPreviewContent(null);
                                    resetFileInput();
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select policy type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="privacy">Privacy Policy</SelectItem>
                                    <SelectItem value="terms">Terms & Conditions</SelectItem>
                                    <SelectItem value="shipping-refund">Shipping & Refund Policy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Upload Document</label>
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            PDF, DOC, DOCX
                                        </p>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>
                            {selectedFile && (
                                <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-2 rounded">
                                    <FileText className="w-4 h-4" />
                                    <span className="truncate">{selectedFile.name}</span>
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={handleUpload}
                            className="w-full"
                            disabled={!selectedFile || uploadMutation.isPending}
                        >
                            {uploadMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Parsing & Uploading...
                                </>
                            ) : (
                                "Upload & Update Policy"
                            )}
                        </Button>

                        <div className="mt-4 text-xs text-muted-foreground">
                            <p>Note: Parsing happens on upload only. Frontend caches the content for performance.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Current Version Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {currentPolicy ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-medium">Active Version Found</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-muted-foreground">Version:</span>
                                    <span>v{currentPolicy.version}</span>
                                    <span className="text-muted-foreground">Last Updated:</span>
                                    <span>{new Date(currentPolicy.updatedAt || "").toLocaleDateString()}</span>
                                    <span className="text-muted-foreground">Title:</span>
                                    <span>{currentPolicy.title}</span>
                                </div>
                                <Button variant="outline" onClick={handlePreview} className="w-full">
                                    <Eye className="w-4 h-4 mr-2" />
                                    Preview Current Content
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-amber-600">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>No active policy found for this type.</span>
                                </div>
                                <p className="text-sm text-muted-foreground">Upload a document to set the initial policy.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <PolicyPreviewDialog
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                title={currentPolicy?.title || "Policy Preview"}
                contentHtml={previewContent}
                lastUpdated={currentPolicy?.updatedAt}
            />
        </div>
    );
}
