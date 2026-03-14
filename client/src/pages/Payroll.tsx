import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { employeeOperations, timeEntryOperations, crewOperations, projectOperations, Employee, TimeEntry } from "@/lib/firestore";
import { calculatePayrollSummary, ProcessedTimeEntry } from "@/lib/payrollRules";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfWeek, endOfWeek, subWeeks, addDays, addWeeks, isWithinInterval, startOfMonth, endOfMonth, subMonths, addMonths, differenceInCalendarDays, isSameDay } from "date-fns";
import { Download, CheckCircle, XCircle, AlertCircle, Calendar as CalendarIcon, DollarSign, Clock, ChevronLeft, ChevronRight, ChevronDown, Users, TrendingUp } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { RoleGuard } from "@/components/RoleGuard";
import { useToast } from "@/hooks/use-toast";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";

interface EmployeePayrollSummary {
    employee: Employee;
    regularHours: number;
    overtimeHours: number;
    doubleTimeHours: number;
    totalHours: number;
    regularPay: number;
    overtimePay: number;
    doubleTimePay: number;
    grossPay: number;
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed' | 'mixed';
    entries: TimeEntry[];
    processedEntries: ProcessedTimeEntry[];
}

function getPayPeriodRange(date: Date, type: string, startDay: number = 0): { start: Date; end: Date; label: string } {
    switch (type) {
        case 'bi-weekly': {
            // 2 weeks starting from startDay
            const ws = startOfWeek(date, { weekStartsOn: startDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
            // Calculate the even week boundary (simplified)
            return {
                start: ws,
                end: addDays(ws, 13),
                label: `${format(ws, "MMM d")} - ${format(addDays(ws, 13), "MMM d, yyyy")}`
            };
        }
        case 'semi-monthly': {
            const monthStart = startOfMonth(date);
            const monthMid = addDays(monthStart, 14); // 15th
            if (date.getDate() <= 15) {
                return {
                    start: monthStart,
                    end: addDays(monthStart, 14),
                    label: `${format(monthStart, "MMM 1")} - ${format(addDays(monthStart, 14), "MMM 15, yyyy")}`
                };
            } else {
                const monthEnd = endOfMonth(date);
                return {
                    start: monthMid,
                    end: monthEnd,
                    label: `${format(monthMid, "MMM 16")} - ${format(monthEnd, "MMM d, yyyy")}`
                };
            }
        }
        case 'monthly': {
            return {
                start: startOfMonth(date),
                end: endOfMonth(date),
                label: format(date, "MMMM yyyy")
            };
        }
        case 'weekly':
        default: {
            const ws = startOfWeek(date, { weekStartsOn: startDay as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
            return {
                start: ws,
                end: addDays(ws, 6),
                label: `${format(ws, "MMM d")} - ${format(addDays(ws, 6), "MMM d, yyyy")}`
            };
        }
    }
}

export default function Payroll() {
    const { org, currentPermissions, user, claims } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const isGlobalAdmin = claims?.globalRole === 'platform_owner' || claims?.globalRole === 'admin' || claims?.globalRole === 'owner';
    const canApprove = hasPermission(currentPermissions, 'approve_timesheets') ||
        hasPermission(currentPermissions, 'manage_payroll') || isGlobalAdmin;
    const canProcessPayroll = hasPermission(currentPermissions, 'manage_payroll') || isGlobalAdmin;
    const canExportPayroll = hasPermission(currentPermissions, 'manage_payroll') || isGlobalAdmin;

    // Reject dialog state
    const [rejectDialog, setRejectDialog] = useState<{
        item: EmployeePayrollSummary;
        selectedDates: string[]; // ISO date strings
        reason: string;
    } | null>(null);

    // Expanded detail rows state
    const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
    const toggleExpanded = (empId: string) => {
        setExpandedEmployees(prev => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId); else next.add(empId);
            return next;
        });
    };

    const payPeriodType = org?.payrollSettings?.payPeriodType || 'weekly';
    const payPeriodStartDay = org?.calendarSettings?.payrollWeekStartsOn ?? 1;

    // OT Rules from org settings
    const otRules = org?.payrollSettings?.overtimeRules;
    const dailyOTThreshold = otRules?.dailyOvertimeThreshold ?? 8;
    const weeklyOTThreshold = otRules?.weeklyOvertimeThreshold ?? 40;
    const dailyDTThreshold = otRules?.dailyDoubleTimeThreshold ?? 12;
    const otMultiplier = otRules?.overtimeMultiplier ?? 1.5;
    const dtMultiplier = otRules?.doubleTimeMultiplier ?? 2.0;

    // Default to current period
    const currentPeriod = getPayPeriodRange(new Date(), payPeriodType, payPeriodStartDay);
    const [dateRange, setDateRange] = useState(currentPeriod);

    const navigatePeriod = (direction: 'prev' | 'next') => {
        const delta = direction === 'next' ? 1 : -1;
        let newDate: Date;
        switch (payPeriodType) {
            case 'bi-weekly':
                newDate = addWeeks(dateRange.start, delta * 2);
                break;
            case 'semi-monthly':
                // Jump by ~15 days
                newDate = addDays(dateRange.start, delta * (dateRange.start.getDate() <= 15 ? 15 : 16));
                break;
            case 'monthly':
                newDate = delta > 0 ? addMonths(dateRange.start, 1) : subMonths(dateRange.start, 1);
                break;
            default: // weekly
                newDate = addWeeks(dateRange.start, delta);
        }
        setDateRange(getPayPeriodRange(newDate, payPeriodType, payPeriodStartDay));
    };

    // Fetch Data
    const { data: employees = [] } = useQuery({
        queryKey: ['employees', org?.id],
        queryFn: () => employeeOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    const { data: crews = [] } = useQuery({
        queryKey: ['crews', org?.id],
        queryFn: () => crewOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    const { data: timeEntries = [] } = useQuery({
        queryKey: ['timeEntries', org?.id],
        queryFn: () => timeEntryOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects', org?.id],
        queryFn: () => projectOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    // Build a project name lookup map
    const projectNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        projects.forEach(p => { map[p.id] = p.name; });
        return map;
    }, [projects]);

    // --- RBAC: Filter employees based on access level ---
    const myEmployeeRecord = useMemo(() =>
        employees.find(e => e.email === user?.email),
        [employees, user?.email]
    );


    const canManagePayroll = hasPermission(currentPermissions, 'manage_payroll') || isGlobalAdmin;

    const myLedCrews = useMemo(() =>
        crews.filter(c => myEmployeeRecord && c.leaderIds?.includes(myEmployeeRecord.id)),
        [crews, myEmployeeRecord]
    );

    const rbacFilteredEmployees = useMemo(() => {
        if (canManagePayroll) return employees; // Full access
        // Crew leaders: see their crew members
        if (myLedCrews.length > 0) {
            const crewMemberIds = new Set<string>();
            myLedCrews.forEach(c => c.memberIds?.forEach(id => crewMemberIds.add(id)));
            if (myEmployeeRecord) crewMemberIds.add(myEmployeeRecord.id);
            return employees.filter(e => crewMemberIds.has(e.id));
        }
        // Self only (shouldn't normally reach payroll, but safety net)
        return myEmployeeRecord ? [myEmployeeRecord] : [];
    }, [canManagePayroll, employees, myLedCrews, myEmployeeRecord]);

    // Process Payroll Data with OT Rules Engine
    const payrollData: EmployeePayrollSummary[] = useMemo(() => {
        return rbacFilteredEmployees.map(emp => {
            const empEntries = timeEntries.filter(te => {
                if (te.employeeId !== emp.id) return false;
                const d = te.date.toDate();
                return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
            });

            // Process using the shared Overtime Rules Engine
            const summary = calculatePayrollSummary(
                empEntries,
                emp,
                org?.payrollSettings?.overtimeRules,
                payPeriodType
            );

            return {
                ...summary,
                entries: summary.originalEntries
            };
        }).filter(d => d.totalHours > 0 || (d.employee.payType === 'salary'));
    }, [rbacFilteredEmployees, timeEntries, dateRange, dailyOTThreshold, weeklyOTThreshold, dailyDTThreshold, otMultiplier, dtMultiplier, payPeriodType]);

    // Only show employees whose entries have been submitted (not pure drafts)
    // Employees with ALL draft entries are still filling out their timesheet — don't show yet
    const activePayroll = payrollData.filter(d => {
        if (d.totalHours === 0 && d.employee.payType !== 'salary') return false;
        // Must have at least one non-draft entry to appear on payroll
        return d.entries.some(e => e.status !== 'draft');
    });

    // Mutations
    const approveMutation = useMutation({
        mutationFn: async (items: EmployeePayrollSummary[]) => {
            const promises: Promise<void>[] = [];
            for (const item of items) {
                for (const entry of item.entries) {
                    // Only approve submitted entries — never approve drafts
                    if (entry.status === 'submitted') {
                        promises.push(timeEntryOperations.update(entry.id, {
                            status: 'approved',
                            approvedBy: user?.uid,
                            approvedAt: Timestamp.now()
                        }));
                    }
                }
            }
            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            toast({ title: "Approved", description: "Timesheets have been approved." });
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "Failed to approve timesheets." });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ entryIds, reason }: { entryIds: string[], reason: string }) => {
            const promises: Promise<void>[] = [];
            for (const id of entryIds) {
                promises.push(timeEntryOperations.update(id, {
                    status: 'rejected',
                    rejectedBy: user?.uid,
                    rejectionNotes: reason || 'Rejected by manager'
                } as any));
            }
            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            setRejectDialog(null);
            toast({ title: "Rejected", description: "Selected entries have been sent back for revision." });
        },
        onError: () => {
            toast({ variant: "destructive", title: "Error", description: "Failed to reject entries." });
        }
    });

    // Helper to open the reject dialog for an employee
    const openRejectDialog = (item: EmployeePayrollSummary) => {
        const submittedDates = Array.from(new Set(item.entries
            .filter(e => e.status === 'submitted')
            .map(e => format(e.date.toDate(), 'yyyy-MM-dd'))
        ));
        setRejectDialog({
            item,
            selectedDates: submittedDates, // Default: all dates selected
            reason: ''
        });
    };

    const handleRejectConfirm = () => {
        if (!rejectDialog) return;
        const entryIds = rejectDialog.item.entries
            .filter(e => e.status === 'submitted' && rejectDialog.selectedDates.includes(format(e.date.toDate(), 'yyyy-MM-dd')))
            .map(e => e.id);
        if (entryIds.length === 0) {
            toast({ variant: "destructive", title: "No entries selected", description: "Please select at least one date to reject." });
            return;
        }
        rejectMutation.mutate({ entryIds, reason: rejectDialog.reason });
    };

    const processMutation = useMutation({
        mutationFn: async (items: EmployeePayrollSummary[]) => {
            const promises: Promise<void>[] = [];
            for (const item of items) {
                for (const entry of item.entries) {
                    if (entry.status === 'approved') {
                        promises.push(timeEntryOperations.update(entry.id, { status: 'processed' }));
                    }
                }
            }
            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            toast({ title: "Processed", description: "Payroll has been marked as processed." });
        },
    });

    const handleExport = () => {
        const headers = ["Employee", "Pay Type", "Rate", "Date", "Project", "Hours", "Work Type", "Pay", "Status"];
        const rows: string[] = [];

        activePayroll.forEach(p => {
            p.processedEntries.forEach(e => {
                const rate = p.employee.payRate || 0;

                rows.push([
                    `"${p.employee.name}"`,
                    p.employee.payType || 'hourly',
                    rate,
                    format(e.date.toDate(), 'yyyy-MM-dd'),
                    e.projectId?.startsWith('_custom_') ? e.projectId.replace('_custom_', '') : (projectNameMap[e.projectId] || e.projectId || '—'),
                    e.calculatedHours,
                    e.calculatedWorkType,
                    e.calculatedPay.toFixed(2),
                    e.status
                ].join(","));
            });
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `payroll_${format(dateRange.start, 'yyyyMMdd')}_${format(dateRange.end, 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Totals
    const totalPayroll = activePayroll.reduce((acc, curr) => acc + curr.grossPay, 0);
    const totalHours = activePayroll.reduce((acc, curr) => acc + curr.totalHours, 0);
    const totalOTHours = activePayroll.reduce((acc, curr) => acc + curr.overtimeHours + curr.doubleTimeHours, 0);
    const pendingCount = activePayroll.filter(p => p.status === 'submitted' || p.status === 'mixed').length;
    const approvedCount = activePayroll.filter(p => p.status === 'approved').length;

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-amber-100 text-amber-800 border-amber-200',
            submitted: 'bg-blue-100 text-blue-800 border-blue-200',
            approved: 'bg-green-100 text-green-800 border-green-200',
            rejected: 'bg-red-100 text-red-800 border-red-200',
            processed: 'bg-gray-100 text-gray-600 border-gray-200',
            mixed: 'bg-purple-100 text-purple-800 border-purple-200',
        };
        const labels: Record<string, string> = {
            draft: 'Pending',
            submitted: 'Submitted',
            approved: 'Approved',
            rejected: 'Rejected',
            processed: 'Processed',
            mixed: 'Mixed',
        };
        return (
            <Badge variant="outline" className={`${styles[status] || ''} capitalize`}>
                {labels[status] || status}
            </Badge>
        );
    };

    return (
        <RoleGuard permission="view_payroll" fallback={<div className="p-8 text-center">You do not have permission to view payroll.</div>}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
                        <p className="text-muted-foreground">
                            {payPeriodType.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())} pay period • Review, approve, and export.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center border rounded-md">
                            <Button variant="ghost" size="icon" onClick={() => navigatePeriod('prev')}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center px-3 py-2">
                                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium whitespace-nowrap">{dateRange.label}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => navigatePeriod('next')}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Est. Gross Payroll</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalPayroll, org?.currency || 'USD')}</div>
                            <p className="text-xs text-muted-foreground">Current period</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground">
                                {totalOTHours > 0 && <span className="text-amber-600">{totalOTHours.toFixed(1)} OT/DT</span>}
                                {totalOTHours === 0 && "No overtime"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{pendingCount}</div>
                            <p className="text-xs text-muted-foreground">Employee{pendingCount !== 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''} review</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ready to Process</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{approvedCount}</div>
                            <p className="text-xs text-muted-foreground">Approved, ready to export</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center gap-2">
                    {canApprove && pendingCount > 0 && (
                        <Button
                            onClick={() => approveMutation.mutate(activePayroll.filter(p => p.status === 'submitted'))}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={approveMutation.isPending}
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve All Submitted ({pendingCount})
                        </Button>
                    )}
                    {canProcessPayroll && approvedCount > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => processMutation.mutate(activePayroll.filter(p => p.status === 'approved'))}
                            disabled={processMutation.isPending}
                        >
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Mark as Processed ({approvedCount})
                        </Button>
                    )}
                    {canExportPayroll && (
                        <Button variant="outline" onClick={handleExport} className="ml-auto">
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    )}
                </div>

                {/* Employee Summary Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Employee Summary</CardTitle>
                        <CardDescription>Review individual timesheets before export.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left font-medium p-3">Employee</th>
                                        <th className="text-center font-medium p-3">Reg hrs</th>
                                        <th className="text-center font-medium p-3">OT hrs</th>
                                        {activePayroll.some(p => p.doubleTimeHours > 0) && (
                                            <th className="text-center font-medium p-3">DT hrs</th>
                                        )}
                                        <th className="text-center font-medium p-3 font-bold">Total</th>
                                        <th className="text-right font-medium p-3">Rate</th>
                                        <th className="text-right font-medium p-3">Gross Pay</th>
                                        <th className="text-center font-medium p-3">Status</th>
                                        <th className="text-right font-medium p-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activePayroll.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center p-8 text-muted-foreground">
                                                No time entries found for this period.
                                            </td>
                                        </tr>
                                    ) : activePayroll.map(item => {
                                        const isExpanded = expandedEmployees.has(item.employee.id);
                                        const hasDT = activePayroll.some(p => p.doubleTimeHours > 0);
                                        const colCount = hasDT ? 9 : 8;

                                        // Group entries by date for detail view
                                        const entriesByDate = item.processedEntries.reduce<Record<string, ProcessedTimeEntry[]>>((acc, e) => {
                                            const dateKey = format(e.date.toDate(), 'yyyy-MM-dd');
                                            if (!acc[dateKey]) acc[dateKey] = [];
                                            acc[dateKey].push(e);
                                            return acc;
                                        }, {});
                                        const sortedDates = Object.keys(entriesByDate).sort();

                                        return (
                                            <>
                                                <tr key={item.employee.id} className={`border-b hover:bg-muted/50 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/30' : ''}`} onClick={() => toggleExpanded(item.employee.id)}>
                                                    <td className="p-3 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                                            <div>
                                                                <div>{item.employee.name}</div>
                                                                <div className="text-xs text-muted-foreground">{item.employee.payType === 'salary' ? 'Salaried' : 'Hourly'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="text-center p-3">{item.regularHours.toFixed(1)}</td>
                                                    <td className="text-center p-3">
                                                        {item.overtimeHours > 0 ? (
                                                            <span className="text-amber-600 font-semibold">{item.overtimeHours.toFixed(1)}</span>
                                                        ) : '—'}
                                                    </td>
                                                    {hasDT && (
                                                        <td className="text-center p-3">
                                                            {item.doubleTimeHours > 0 ? (
                                                                <span className="text-red-600 font-semibold">{item.doubleTimeHours.toFixed(1)}</span>
                                                            ) : '—'}
                                                        </td>
                                                    )}
                                                    <td className="text-center p-3 font-bold">{item.totalHours.toFixed(1)}</td>
                                                    <td className="text-right p-3 text-muted-foreground">
                                                        {item.employee.payType === 'salary'
                                                            ? `${formatCurrency(item.employee.payRate || 0, org?.currency || 'USD')}/yr`
                                                            : `${formatCurrency(item.employee.payRate || 0, org?.currency || 'USD')}/hr`
                                                        }
                                                    </td>
                                                    <td className="text-right p-3 font-semibold">
                                                        {formatCurrency(item.grossPay, org?.currency || 'USD')}
                                                    </td>
                                                    <td className="text-center p-3">{statusBadge(item.status)}</td>
                                                    <td className="text-right p-3" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {canApprove && (item.status === 'submitted' || item.status === 'mixed') && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-2"
                                                                        onClick={() => approveMutation.mutate([item])}
                                                                        disabled={approveMutation.isPending}
                                                                        title="Approve"
                                                                    >
                                                                        <CheckCircle className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                                                                        onClick={() => openRejectDialog(item)}
                                                                        disabled={rejectMutation.isPending}
                                                                        title="Reject"
                                                                    >
                                                                        <XCircle className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {item.status === 'approved' && canProcessPayroll && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-primary hover:bg-primary/10 h-8 px-2"
                                                                    onClick={() => processMutation.mutate([item])}
                                                                    title="Mark as Processed"
                                                                >
                                                                    <TrendingUp className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {item.status === 'rejected' && (
                                                                <span className="text-xs text-red-500 italic">Needs revision</span>
                                                            )}
                                                            {item.status === 'processed' && (
                                                                <span className="text-xs text-muted-foreground">Done</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr key={`${item.employee.id}-detail`} className="bg-muted/20">
                                                        <td colSpan={colCount} className="p-0">
                                                            <div className="px-6 py-3 border-b">
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="text-muted-foreground">
                                                                            <th className="text-left font-medium py-1 px-2 w-[140px]">Date</th>
                                                                            <th className="text-left font-medium py-1 px-2">Project / Job</th>
                                                                            <th className="text-center font-medium py-1 px-2 w-[70px]">Hours</th>
                                                                            <th className="text-center font-medium py-1 px-2 w-[80px]">Type</th>
                                                                            <th className="text-center font-medium py-1 px-2 w-[90px]">Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {sortedDates.map(dateKey => (
                                                                            entriesByDate[dateKey].map((entry, idx) => {
                                                                                const projectName = entry.projectId?.startsWith('_custom_')
                                                                                    ? `✏️ ${entry.projectId.replace('_custom_', '')}`
                                                                                    : (projectNameMap[entry.projectId] || entry.projectId || '—');
                                                                                return (
                                                                                    <tr key={entry.id || `${dateKey}-${idx}`} className="border-t border-muted/40">
                                                                                        <td className="py-1.5 px-2 text-muted-foreground">
                                                                                            {format(new Date(dateKey + 'T12:00:00'), 'EEE, MMM d')}
                                                                                        </td>
                                                                                        <td className="py-1.5 px-2 font-medium">{projectName}</td>
                                                                                        <td className="py-1.5 px-2 text-center">{entry.calculatedHours.toFixed(1)}</td>
                                                                                        <td className="py-1.5 px-2 text-center capitalize">
                                                                                            <span className={entry.calculatedWorkType === 'overtime' ? 'text-amber-600' : entry.calculatedWorkType === 'double_time' ? 'text-red-600' : ''}>
                                                                                                {entry.calculatedWorkType === 'double_time' ? 'DT' : entry.calculatedWorkType === 'overtime' ? 'OT' : entry.calculatedWorkType === 'travel' ? 'Travel' : 'Reg'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-1.5 px-2 text-center">
                                                                                            {statusBadge(entry.status)}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                                {activePayroll.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 font-bold bg-muted/30">
                                            <td className="p-3">Totals ({activePayroll.length} employees)</td>
                                            <td className="text-center p-3">{activePayroll.reduce((s, p) => s + p.regularHours, 0).toFixed(1)}</td>
                                            <td className="text-center p-3 text-amber-600">
                                                {activePayroll.reduce((s, p) => s + p.overtimeHours, 0).toFixed(1)}
                                            </td>
                                            {activePayroll.some(p => p.doubleTimeHours > 0) && (
                                                <td className="text-center p-3 text-red-600">
                                                    {activePayroll.reduce((s, p) => s + p.doubleTimeHours, 0).toFixed(1)}
                                                </td>
                                            )}
                                            <td className="text-center p-3">{totalHours.toFixed(1)}</td>
                                            <td className="p-3"></td>
                                            <td className="text-right p-3">
                                                {formatCurrency(totalPayroll, org?.currency || 'USD')}
                                            </td>
                                            <td className="p-3"></td>
                                            <td className="p-3"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* OT Rules Info */}
                <Card className="border-dashed">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>
                                Overtime rules: Daily OT after {dailyOTThreshold}hrs ({otMultiplier}x),
                                Double time after {dailyDTThreshold}hrs ({dtMultiplier}x),
                                Weekly OT after {weeklyOTThreshold}hrs.
                                {org?.payrollSettings?.overtimeRules ? '' : ' Using defaults — configure in Settings.'}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Reject Dialog */}
                <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Reject Time Entries</DialogTitle>
                            <DialogDescription>
                                Select which dates to reject for <strong>{rejectDialog?.item.employee.name}</strong> and provide a reason.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium">Select dates to reject:</Label>
                                <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                                    {rejectDialog && Array.from(new Set(rejectDialog.item.entries
                                        .filter(e => e.status === 'submitted')
                                        .map(e => format(e.date.toDate(), 'yyyy-MM-dd'))
                                    )).map(dateStr => {
                                        const dayEntries = rejectDialog.item.entries.filter(
                                            e => format(e.date.toDate(), 'yyyy-MM-dd') === dateStr && e.status === 'submitted'
                                        );
                                        const dayHours = dayEntries.reduce((s, e) => s + e.totalHours, 0);
                                        const isSelected = rejectDialog.selectedDates.includes(dateStr);

                                        return (
                                            <label key={dateStr} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked: boolean) => {
                                                        setRejectDialog(prev => prev ? {
                                                            ...prev,
                                                            selectedDates: checked
                                                                ? [...prev.selectedDates, dateStr]
                                                                : prev.selectedDates.filter(d => d !== dateStr)
                                                        } : null);
                                                    }}
                                                />
                                                <span className="flex-1 text-sm">
                                                    {format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMM d')}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{dayHours.toFixed(1)} hrs</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="reject-reason" className="text-sm font-medium">Reason for rejection:</Label>
                                <Textarea
                                    id="reject-reason"
                                    placeholder="Please explain what needs to be corrected..."
                                    value={rejectDialog?.reason || ''}
                                    onChange={(e) => setRejectDialog(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                    className="mt-1"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={handleRejectConfirm}
                                disabled={rejectMutation.isPending || (rejectDialog?.selectedDates.length === 0)}
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject {rejectDialog?.selectedDates.length || 0} {(rejectDialog?.selectedDates.length || 0) === 1 ? 'Day' : 'Days'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </RoleGuard >
    );
}
