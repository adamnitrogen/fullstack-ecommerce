import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, ChevronLeft, ChevronRight, Eye, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Job {
    id: string;
    type: string;
    status: string;
    mode: string;
    userId: string;
    userEmail: string;
    userName: string;
    currentStep: string | null;
    stepsCompleted: string[];
    errorLog: Array<{ step?: string; error?: string; message?: string; timestamp: string }>;
    retryCount: number;
    scheduledFor: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    correlationId: string;
}

interface JobsResponse {
    success: boolean;
    jobs: Job[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "BLOCKED", label: "Blocked" },
    { value: "CANCELLED", label: "Cancelled" },
];

const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
        PENDING: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
        IN_PROGRESS: { variant: "default", className: "bg-blue-500 hover:bg-blue-500" },
        COMPLETED: { variant: "default", className: "bg-green-500 hover:bg-green-500" },
        FAILED: { variant: "destructive", className: "" },
        BLOCKED: { variant: "secondary", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
        CANCELLED: { variant: "secondary", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
    };
    const config = variants[status] || { variant: "outline" as const, className: "" };
    return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
};

const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-IN", {
        dateStyle: "short",
        timeStyle: "short",
    });
};

export default function JobsManagement() {
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const queryClient = useQueryClient();
    const limit = 15;

    const { data, isLoading, refetch, isFetching } = useQuery<JobsResponse>({
        queryKey: ["admin-jobs", statusFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", limit.toString());
            if (statusFilter !== "all") params.set("status", statusFilter);
            const response = await apiClient.get(`/admin/jobs?${params.toString()}`);
            return response.data;
        },
    });

    const retryMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/retry`);
            return response.data;
        },
        onSuccess: () => {
            toast.success("Job retry triggered successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: Error & { response?: { data?: { error?: string } } }) => {
            toast.error(error.response?.data?.error || "Failed to retry job");
        },
    });

    const processMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/process`);
            return response.data;
        },
        onSuccess: () => {
            toast.success("Job processing triggered successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: Error & { response?: { data?: { error?: string } } }) => {
            toast.error(error.response?.data?.error || "Failed to process job");
        },
    });

    const handleViewDetails = (job: Job) => {
        setSelectedJob(job);
        setDetailsOpen(true);
    };

    const handleRetry = (jobId: string) => {
        retryMutation.mutate(jobId);
    };

    const handleProcess = (jobId: string) => {
        processMutation.mutate(jobId);
    };

    const jobs = data?.jobs || [];
    const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

    // Mobile Job Card Component
    const JobCard = ({ job }: { job: Job }) => (
        <Card className="mb-3">
            <CardContent className="p-4 space-y-3">
                {/* Header: Status + Type */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(job.status)}
                        <Badge variant="outline" className="text-xs">
                            {job.type.replace("_", " ")}
                        </Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                        {job.id.slice(0, 8)}...
                    </span>
                </div>

                {/* User info */}
                <div>
                    <p className="font-medium text-sm">{job.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.userEmail}</p>
                </div>

                {/* Current Step */}
                {job.currentStep && (
                    <div>
                        <span className="text-xs text-muted-foreground">Current Step: </span>
                        <span className="text-xs font-mono">{job.currentStep}</span>
                    </div>
                )}

                {/* Dates */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Created: {formatDate(job.createdAt)}</span>
                    <span>Updated: {formatDate(job.updatedAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleViewDetails(job)}
                    >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                    </Button>
                    {job.status === "PENDING" && (
                        <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleProcess(job.id)}
                            disabled={processMutation.isPending}
                        >
                            <Play className="h-4 w-4 mr-1" />
                            Process
                        </Button>
                    )}
                    {(job.status === "FAILED" || job.status === "BLOCKED") && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={() => handleRetry(job.id)}
                            disabled={retryMutation.isPending}
                        >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Retry
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header - Responsive */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Background Jobs</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Monitor and manage background processing jobs
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="w-full sm:w-auto"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Filters - Responsive */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                    Total: {pagination.total} jobs
                </span>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                    Loading jobs...
                </div>
            )}

            {/* Empty State */}
            {!isLoading && jobs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    No jobs found.
                </div>
            )}

            {/* Mobile Card View (shown on small screens) */}
            {!isLoading && jobs.length > 0 && (
                <div className="block lg:hidden">
                    {jobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                    ))}
                </div>
            )}

            {/* Desktop Table View (hidden on small screens) */}
            {!isLoading && jobs.length > 0 && (
                <div className="hidden lg:block border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">ID</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Current Step</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Updated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jobs.map((job) => (
                                <TableRow key={job.id}>
                                    <TableCell className="font-mono text-xs">
                                        {job.id.slice(0, 8)}...
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{job.type.replace("_", " ")}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{job.userName}</span>
                                            <span className="text-xs text-muted-foreground">{job.userEmail}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                                    <TableCell className="text-xs font-mono">
                                        {job.currentStep || "-"}
                                    </TableCell>
                                    <TableCell className="text-xs">{formatDate(job.createdAt)}</TableCell>
                                    <TableCell className="text-xs">{formatDate(job.updatedAt)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleViewDetails(job)}
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            {job.status === "PENDING" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleProcess(job.id)}
                                                    disabled={processMutation.isPending}
                                                    title="Process Job"
                                                    className="text-green-600 hover:text-green-700"
                                                >
                                                    <Play className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {(job.status === "FAILED" || job.status === "BLOCKED") && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRetry(job.id)}
                                                    disabled={retryMutation.isPending}
                                                    title="Retry Job"
                                                    className="text-orange-600 hover:text-orange-700"
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Pagination - Responsive */}
            {!isLoading && jobs.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground order-2 sm:order-1">
                        Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex-1 sm:flex-none"
                        >
                            <ChevronLeft className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Previous</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                            disabled={page >= pagination.totalPages}
                            className="flex-1 sm:flex-none"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight className="h-4 w-4 sm:ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Details Dialog - Responsive */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Job Details</DialogTitle>
                    </DialogHeader>
                    {selectedJob && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Job ID:</span>
                                    <p className="font-mono text-xs sm:text-sm break-all">{selectedJob.id}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Correlation ID:</span>
                                    <p className="font-mono text-xs break-all">{selectedJob.correlationId}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Type:</span>
                                    <p>{selectedJob.type}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Mode:</span>
                                    <p>{selectedJob.mode}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status:</span>
                                    <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Retry Count:</span>
                                    <p>{selectedJob.retryCount}</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="text-muted-foreground">User:</span>
                                    <p className="break-all">{selectedJob.userName} ({selectedJob.userEmail})</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Current Step:</span>
                                    <p className="font-mono text-xs sm:text-sm">{selectedJob.currentStep || "-"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Created:</span>
                                    <p>{formatDate(selectedJob.createdAt)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Updated:</span>
                                    <p>{formatDate(selectedJob.updatedAt)}</p>
                                </div>
                                {selectedJob.scheduledFor && (
                                    <div>
                                        <span className="text-muted-foreground">Scheduled For:</span>
                                        <p>{formatDate(selectedJob.scheduledFor)}</p>
                                    </div>
                                )}
                                {selectedJob.completedAt && (
                                    <div>
                                        <span className="text-muted-foreground">Completed:</span>
                                        <p>{formatDate(selectedJob.completedAt)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Steps Completed */}
                            {selectedJob.stepsCompleted && selectedJob.stepsCompleted.length > 0 && (
                                <div>
                                    <span className="text-muted-foreground text-sm">Steps Completed:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {selectedJob.stepsCompleted.map((step, i) => (
                                            <Badge key={i} variant="outline" className="text-xs">
                                                {step}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Error Log */}
                            {selectedJob.errorLog && selectedJob.errorLog.length > 0 && (
                                <div>
                                    <span className="text-muted-foreground text-sm">Error Log:</span>
                                    <div className="mt-1 space-y-2">
                                        {selectedJob.errorLog.map((err, i) => (
                                            <div
                                                key={i}
                                                className="p-2 bg-red-50 border border-red-100 rounded text-xs"
                                            >
                                                <p className="font-medium text-red-800 break-words">
                                                    {err.step && `[${err.step}] `}
                                                    {err.error || err.message}
                                                </p>
                                                <p className="text-red-600">{formatDate(err.timestamp)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Process/Retry Button */}
                            {selectedJob.status === "PENDING" && (
                                <Button
                                    onClick={() => {
                                        handleProcess(selectedJob.id);
                                        setDetailsOpen(false);
                                    }}
                                    disabled={processMutation.isPending}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Process This Job
                                </Button>
                            )}
                            {(selectedJob.status === "FAILED" || selectedJob.status === "BLOCKED") && (
                                <Button
                                    onClick={() => {
                                        handleRetry(selectedJob.id);
                                        setDetailsOpen(false);
                                    }}
                                    disabled={retryMutation.isPending}
                                    className="w-full"
                                >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Retry This Job
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
