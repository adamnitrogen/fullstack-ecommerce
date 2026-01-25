import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Eye,
    RotateCcw,
    Play,
    Calendar,
    User,
    Mail,
    FileText,
    Clock,
    CheckCircle2,
    AlertCircle,
    Activity
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Type Definitions
interface Job {
    id: string;
    type: "ACCOUNT_DELETION" | "EVENT_CANCELLATION";
    status: string;
    mode: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    currentStep?: string | null;
    stepsCompleted?: string[];
    scheduledFor?: string | null;
    eventId?: string;
    eventTitle?: string;
    eventStatus?: string;
    eventStartDate?: string;
    eventLocation?: string;
    totalRegistrations?: number;
    processedCount?: number;
    failedCount?: number;
    batchSize?: number;
    errorLog: Array<{ step?: string; error?: string; message?: string; timestamp: string; registrationId?: string }>;
    retryCount: number;
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

interface SchedulerStatus {
    success: boolean;
    running: boolean;
    jobs: Array<{ index: number; running: boolean }>;
    schedules: Record<string, string>;
}

interface StatsResponse {
    success: boolean;
    stats: any;
}

// Constants
const TYPE_OPTIONS = [
    { value: "all", label: "All Job Types" },
    { value: "ACCOUNT_DELETION", label: "Account Deletion" },
    { value: "EVENT_CANCELLATION", label: "Event Cancellation" },
];

const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "PARTIAL_FAILURE", label: "Partial Failure" },
    { value: "BLOCKED", label: "Blocked" },
    { value: "CANCELLED", label: "Cancelled" },
];

// Helper Components
const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
        PENDING: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
        IN_PROGRESS: { variant: "default", className: "bg-blue-500 hover:bg-blue-500" },
        COMPLETED: { variant: "default", className: "bg-green-500 hover:bg-green-500" },
        FAILED: { variant: "destructive", className: "" },
        PARTIAL_FAILURE: { variant: "secondary", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
        BLOCKED: { variant: "secondary", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
        CANCELLED: { variant: "secondary", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
    };
    const config = variants[status] || { variant: "outline" as const, className: "" };
    return <Badge variant={config.variant} className={config.className}>{status.replace("_", " ")}</Badge>;
};

const getTypeBadge = (type: string) => {
    if (type === "ACCOUNT_DELETION") {
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><User className="h-3 w-3 mr-1" />Account Deletion</Badge>;
    }
    return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><Calendar className="h-3 w-3 mr-1" />Event Cancellation</Badge>;
};

const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-IN", {
        dateStyle: "short",
        timeStyle: "short",
    });
};

export default function BackgroundJobs() {
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const queryClient = useQueryClient();
    const limit = 10;

    // --- Queries ---

    // 1. Batch Jobs Query
    const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs, isFetching: jobsFetching } = useQuery<JobsResponse>({
        queryKey: ["admin-jobs", typeFilter, statusFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", limit.toString());
            if (typeFilter !== "all") params.set("type", typeFilter);
            if (statusFilter !== "all") params.set("status", statusFilter);
            const response = await apiClient.get(`/admin/jobs?${params.toString()}`);
            return response.data;
        },
    });

    // 2. Scheduler Status Query
    const { data: schedStatus, refetch: refetchSched, isFetching: schedFetching } = useQuery<SchedulerStatus>({
        queryKey: ["admin-scheduler-status"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/scheduler-status');
            return response.data;
        },
        refetchInterval: 10000, // Auto refresh every 10 seconds as requested
    });

    // 3. Email Stats Query
    const { data: emailStatsData, refetch: refetchEmailStats } = useQuery<StatsResponse>({
        queryKey: ["admin-email-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/email-stats');
            return response.data;
        },
        refetchInterval: 10000,
    });

    // 4. Invoice Stats Query
    const { data: invoiceStatsData, refetch: refetchInvoiceStats } = useQuery<StatsResponse>({
        queryKey: ["admin-invoice-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/invoice-stats');
            return response.data;
        },
        refetchInterval: 10000,
    });

    // --- Mutations ---

    const retryJobMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/retry`);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Job retry triggered successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to retry job");
        },
    });

    const processJobMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/process`);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Job processing triggered successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to process job");
        },
    });

    const triggerEmailRetry = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/email-retry');
            return response.data;
        },
        onSuccess: () => {
            toast.success("Email retry triggered successfully");
            refetchEmailStats();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to trigger email retry");
        }
    });

    const triggerInvoiceRetry = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/invoice-retry');
            return response.data;
        },
        onSuccess: () => {
            toast.success("Invoice retry triggered successfully");
            refetchInvoiceStats();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to trigger invoice retry");
        }
    });

    // --- Handlers ---

    const handleViewDetails = (job: Job) => {
        setSelectedJob(job);
        setDetailsOpen(false); // Fix potential double dialog
        setTimeout(() => setDetailsOpen(true), 10);
    };

    const handleRefreshAll = () => {
        refetchJobs();
        refetchSched();
        refetchEmailStats();
        refetchInvoiceStats();
    };

    const canRetry = (job: Job) => {
        if (job.type === "ACCOUNT_DELETION") {
            return job.status === "FAILED" || job.status === "BLOCKED";
        }
        return job.status === "FAILED" || job.status === "PARTIAL_FAILURE";
    };

    const jobs = jobsData?.jobs || [];
    const pagination = jobsData?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

    // Common info for batch jobs
    const getJobSubject = (job: Job) => {
        if (job.type === "ACCOUNT_DELETION") {
            return {
                primary: job.userName || "N/A",
                secondary: job.userEmail || "N/A"
            };
        }
        return {
            primary: job.eventTitle || "Unknown Event",
            secondary: `${job.processedCount || 0}/${job.totalRegistrations || 0} processed`
        };
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Background Jobs</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Monitor and manage system background processes
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefreshAll}
                    disabled={jobsFetching || schedFetching}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${(jobsFetching || schedFetching) ? "animate-spin" : ""}`} />
                    Refresh All
                </Button>
            </div>

            <Tabs defaultValue="scheduled" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="scheduled">
                        <Clock className="h-4 w-4 mr-2" />
                        Scheduled Tasks
                    </TabsTrigger>
                    <TabsTrigger value="batch">
                        <Activity className="h-4 w-4 mr-2" />
                        Batch Jobs
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Scheduled Tasks */}
                <TabsContent value="scheduled" className="space-y-6 pt-4">
                    {/* System Status Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                    Scheduler Status
                                    {schedStatus?.running ?
                                        <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                                        <AlertCircle className="h-4 w-4 text-destructive" />
                                    }
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{schedStatus?.running ? "Running" : "Stopped"}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {schedStatus?.jobs?.length || 0} active cron jobs
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                    Failed Emails
                                    <Mail className="h-4 w-4" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-destructive">
                                    {emailStatsData?.stats?.FAILED || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Pending retry attempts
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                    Failed Invoices
                                    <FileText className="h-4 w-4" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-destructive">
                                    {invoiceStatsData?.stats?.orders?.failed || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Requires re-generation
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Manual Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Email Retry Engine</CardTitle>
                                <CardDescription>
                                    Manually trigger a retry for all emails currently in 'FAILED' status.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-3 bg-muted rounded-md text-sm">
                                    <div className="flex justify-between mb-1">
                                        <span>Total Notifications:</span>
                                        <span className="font-medium">{String(Object.values(emailStatsData?.stats || {}).reduce((a: any, b: any) => a + b, 0))}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span>Sent:</span>
                                        <span className="text-green-600 font-medium">{emailStatsData?.stats?.SENT || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Failed:</span>
                                        <span className="text-destructive font-medium">{emailStatsData?.stats?.FAILED || 0}</span>
                                    </div>
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={() => triggerEmailRetry.mutate()}
                                    disabled={triggerEmailRetry.isPending || (emailStatsData?.stats?.FAILED || 0) === 0}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Run Email Retry Job
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Invoice Recovery</CardTitle>
                                <CardDescription>
                                    Trigger re-generation for orders where the GST invoice failed.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-3 bg-muted rounded-md text-sm">
                                    <div className="flex justify-between mb-1">
                                        <span>Orders with Invoices:</span>
                                        <span className="font-medium">{invoiceStatsData?.stats?.orders?.generated || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Failed Generation:</span>
                                        <span className="text-destructive font-medium">{invoiceStatsData?.stats?.orders?.failed || 0}</span>
                                    </div>
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={() => triggerInvoiceRetry.mutate()}
                                    disabled={triggerInvoiceRetry.isPending || (invoiceStatsData?.stats?.orders?.failed || 0) === 0}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    Run Invoice Retry Job
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Configured Schedules */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Configured Schedules (Cron)</CardTitle>
                            <CardDescription>System intervals for recurring tasks</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Task Name</TableHead>
                                        <TableHead>Schedule (Cron)</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {schedStatus?.schedules && Object.entries(schedStatus.schedules).map(([key, value]) => (
                                        <TableRow key={key}>
                                            <TableCell className="font-medium font-mono">{key}</TableCell>
                                            <TableCell className="font-mono text-xs">{value}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">ACTIVE</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Batch Jobs (Legacy View) */}
                <TabsContent value="batch" className="space-y-4 pt-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        <span className="text-sm text-muted-foreground ml-auto">
                            Showing {jobs.length} of {pagination.total} jobs
                        </span>
                    </div>

                    {/* Table View */}
                    <div className="border rounded-lg overflow-x-auto bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">ID</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobsLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                                ) : jobs.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8">No jobs found.</TableCell></TableRow>
                                ) : (
                                    jobs.map((job) => {
                                        const subject = getJobSubject(job);
                                        return (
                                            <TableRow key={job.id}>
                                                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}...</TableCell>
                                                <TableCell>{getTypeBadge(job.type)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{subject.primary}</span>
                                                        <span className="text-xs text-muted-foreground">{subject.secondary}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(job.status)}</TableCell>
                                                <TableCell className="text-xs">{formatDate(job.updatedAt)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(job)} title="View Details">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {job.status === "PENDING" && (
                                                            <Button
                                                                variant="ghost" size="icon"
                                                                onClick={() => processJobMutation.mutate(job.id)}
                                                                disabled={processJobMutation.isPending}
                                                                title="Process Job"
                                                                className="text-green-600"
                                                            >
                                                                <Play className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canRetry(job) && (
                                                            <Button
                                                                variant="ghost" size="icon"
                                                                onClick={() => retryJobMutation.mutate(job.id)}
                                                                disabled={retryJobMutation.isPending}
                                                                title="Retry Job"
                                                                className="text-orange-600"
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between gap-3 pt-2">
                            <p className="text-sm text-muted-foreground">
                                Page {pagination.page} of {pagination.totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline" size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                </Button>
                                <Button
                                    variant="outline" size="sm"
                                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                    disabled={page >= pagination.totalPages}
                                >
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Details Dialog (Unified for all jobs) */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Job Details
                            {selectedJob && getTypeBadge(selectedJob.type)}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedJob && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Job ID:</span>
                                    <p className="font-mono text-xs sm:text-sm break-all">{selectedJob.id}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status:</span>
                                    <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                                </div>
                                {selectedJob.type === "ACCOUNT_DELETION" && (
                                    <>
                                        <div className="sm:col-span-2">
                                            <span className="text-muted-foreground">User:</span>
                                            <p className="break-all font-medium">{selectedJob.userName} ({selectedJob.userEmail})</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Current Step:</span>
                                            <p className="font-mono text-xs">{selectedJob.currentStep || "LOCK_USER"}</p>
                                        </div>
                                    </>
                                )}
                                {selectedJob.type === "EVENT_CANCELLATION" && (
                                    <>
                                        <div className="sm:col-span-2">
                                            <span className="text-muted-foreground">Event:</span>
                                            <p className="font-medium">{selectedJob.eventTitle}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Processed:</span>
                                            <p>{selectedJob.processedCount || 0} / {selectedJob.totalRegistrations || 0}</p>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <span className="text-muted-foreground">Created At:</span>
                                    <p>{formatDate(selectedJob.createdAt)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Updated At:</span>
                                    <p>{formatDate(selectedJob.updatedAt)}</p>
                                </div>
                            </div>

                            {selectedJob.errorLog && selectedJob.errorLog.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-muted-foreground text-sm font-medium">Logs & Errors:</span>
                                    <div className="p-3 bg-destructive/5 border border-destructive/10 rounded-md max-h-40 overflow-y-auto">
                                        {selectedJob.errorLog.map((log, i) => (
                                            <div key={i} className="text-xs mb-2 pb-2 border-b border-destructive/5 last:border-0">
                                                <div className="font-mono text-destructive mb-1">{log.step || "Error"}</div>
                                                <div className="text-muted-foreground italic">{log.message || log.error}</div>
                                                <div className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(log.timestamp)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                {selectedJob.status === "PENDING" && (
                                    <Button
                                        className="flex-1 bg-green-600"
                                        onClick={() => { processJobMutation.mutate(selectedJob.id); setDetailsOpen(false); }}
                                    >
                                        <Play className="h-4 w-4 mr-2" /> Start Processing
                                    </Button>
                                )}
                                {canRetry(selectedJob) && (
                                    <Button
                                        className="flex-1"
                                        onClick={() => { retryJobMutation.mutate(selectedJob.id); setDetailsOpen(false); }}
                                    >
                                        <RotateCcw className="h-4 w-4 mr-2" /> Retry Job
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
