import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { employeeOperations, crewOperations, timeEntryOperations, Employee } from "@/lib/firestore";
import { calculatePayrollSummary } from "@/lib/payrollRules";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Shield, Users, User, Send, AlertTriangle } from "lucide-react";
import { TimeEntryDialog } from "@/components/TimeEntryDialog";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";

type AccessLevel = 'all' | 'crew' | 'self';

export default function TimeTracking() {
    const { org, user, claims, currentPermissions } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCrewId, setSelectedCrewId] = useState<string>("all");
    const [dialogState, setDialogState] = useState<{ open: boolean; employee: any; date: Date } | null>(null);
    const [confirmSubmit, setConfirmSubmit] = useState<{ employee: Employee; draftCount: number } | null>(null);

    // Get week range
    const weekStart = startOfWeek(currentDate, { weekStartsOn: (org?.calendarSettings?.timesheetWeekStartsOn ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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
        queryKey: ['timeEntries', org?.id, weekStart.toISOString()],
        queryFn: async () => {
            const all = await timeEntryOperations.getByOrg(org!.id);
            return all.filter(te => {
                const d = te.date.toDate();
                return d >= weekStart && d <= addDays(weekStart, 6);
            });
        },
        enabled: !!org,
    });

    // --- RBAC: Determine Access Level ---
    const myEmployeeRecord = useMemo(() =>
        employees.find(e => e.email === user?.email),
        [employees, user?.email]
    );

    const isGlobalAdmin = claims?.globalRole === 'platform_owner' || claims?.globalRole === 'admin' || claims?.globalRole === 'owner';
    const canViewPayroll = hasPermission(currentPermissions, 'view_payroll') || hasPermission(currentPermissions, 'manage_payroll');
    const canLogCrewTime = hasPermission(currentPermissions, 'log_crew_time');

    const myLedCrews = useMemo(() =>
        crews.filter(c => myEmployeeRecord && c.leaderIds?.includes(myEmployeeRecord.id)),
        [crews, myEmployeeRecord]
    );

    const accessLevel: AccessLevel = useMemo(() => {
        if (isGlobalAdmin || canViewPayroll || canLogCrewTime) return 'all';
        if (myLedCrews.length > 0) return 'crew';
        return 'self';
    }, [isGlobalAdmin, canViewPayroll, canLogCrewTime, myLedCrews]);

    const rbacFilteredEmployees: Employee[] = useMemo(() => {
        switch (accessLevel) {
            case 'all':
                return employees;
            case 'crew': {
                const crewMemberIds = new Set<string>();
                myLedCrews.forEach(c => c.memberIds?.forEach(id => crewMemberIds.add(id)));
                if (myEmployeeRecord) crewMemberIds.add(myEmployeeRecord.id);
                return employees.filter(e => crewMemberIds.has(e.id));
            }
            case 'self':
                return myEmployeeRecord ? [myEmployeeRecord] : [];
        }
    }, [accessLevel, employees, myLedCrews, myEmployeeRecord]);

    const visibleEmployees = selectedCrewId === "all"
        ? rbacFilteredEmployees
        : rbacFilteredEmployees.filter(e => {
            const crew = crews.find(c => c.id === selectedCrewId);
            return crew?.memberIds?.includes(e.id);
        });

    const availableCrews = useMemo(() => {
        if (accessLevel === 'all') return crews;
        if (accessLevel === 'crew') return myLedCrews;
        return [];
    }, [accessLevel, crews, myLedCrews]);

    const navigateWeek = (direction: 'prev' | 'next') => {
        setCurrentDate(addDays(currentDate, direction === 'next' ? 7 : -7));
    };

    const handleOpenDetails = (employee: Employee, date: Date) => {
        setDialogState({ open: true, employee, date });
    };

    const canEditEmployee = (emp: Employee) => {
        if (isGlobalAdmin || canLogCrewTime) return true;
        if (accessLevel === 'crew') {
            return myLedCrews.some(c => c.memberIds?.includes(emp.id));
        }
        return emp.id === myEmployeeRecord?.id;
    };

    // Per-employee submit mutation
    const submitEmployeeWeekMutation = useMutation({
        mutationFn: async (employeeId: string) => {
            const drafts = timeEntries.filter(te =>
                te.employeeId === employeeId && te.status === 'draft'
            );
            const promises = drafts.map(entry =>
                timeEntryOperations.update(entry.id, {
                    status: 'submitted',
                    updatedAt: Timestamp.now()
                })
            );
            await Promise.all(promises);
            return drafts.length;
        },
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            setConfirmSubmit(null);
            toast({
                title: "Submitted",
                description: `${count} time entries submitted for approval.`,
            });
        },
        onError: () => {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to submit timesheet. Please try again.",
            });
        }
    });

    const AccessIcon = accessLevel === 'all' ? Shield : accessLevel === 'crew' ? Users : User;

    // Compute rejected entries from visible employees for notification banner
    const rejectedInfo = useMemo(() => {
        const visibleEmpIds = new Set(visibleEmployees.map(e => e.id));
        const rejected = timeEntries.filter(te =>
            visibleEmpIds.has(te.employeeId) && te.status === 'rejected'
        );
        if (rejected.length === 0) return null;

        // Group by employee
        const byEmployee: Record<string, { name: string; dates: string[] }> = {};
        rejected.forEach(te => {
            const emp = visibleEmployees.find(e => e.id === te.employeeId);
            if (!emp) return;
            if (!byEmployee[te.employeeId]) {
                byEmployee[te.employeeId] = { name: emp.name, dates: [] };
            }
            const dateStr = format(te.date.toDate(), 'EEE, MMM d');
            if (!byEmployee[te.employeeId].dates.includes(dateStr)) {
                byEmployee[te.employeeId].dates.push(dateStr);
            }
        });
        return Object.values(byEmployee);
    }, [timeEntries, visibleEmployees]);

    return (
        <div className="space-y-6">
            {/* Rejected Dates Notification Banner */}
            {rejectedInfo && rejectedInfo.length > 0 && (
                <Card className="border-red-300 bg-red-50/50">
                    <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <p className="font-medium text-sm text-red-800">Rejected Time Entries Require Attention</p>
                                <div className="text-xs text-red-700 space-y-0.5">
                                    {rejectedInfo.map(({ name, dates }) => (
                                        <p key={name}>
                                            <strong>{name}</strong>: {dates.join(', ')}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Time Tracking</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        <AccessIcon className="h-3.5 w-3.5" />
                        <span>
                            {accessLevel === 'self' && 'Viewing your own timesheet.'}
                            {accessLevel === 'crew' && `Viewing ${myLedCrews.map(c => c.name).join(', ')} crew time.`}
                            {accessLevel === 'all' && 'Managing all employee time.'}
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {availableCrews.length > 0 && accessLevel !== 'self' && (
                        <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by Crew" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All {accessLevel === 'crew' ? 'My Crews' : 'Employees'}</SelectItem>
                                {availableCrews.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="w-40 text-center font-medium text-sm">
                            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Weekly Timesheet</CardTitle>
                    {accessLevel !== 'all' && (
                        <CardDescription className="text-xs">
                            {accessLevel === 'self' ? 'Click a cell to log your hours.' : 'Click a cell to log or edit hours for your crew.'}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left font-medium p-2 w-[200px]">Employee</th>
                                    {weekDays.map(day => (
                                        <th key={day.toISOString()} className={`text-center font-medium p-2 ${isSameDay(day, new Date()) ? 'bg-primary/5 text-primary' : ''}`}>
                                            <div className="text-xs text-muted-foreground uppercase">{format(day, "EEE")}</div>
                                            <div>{format(day, "d")}</div>
                                        </th>
                                    ))}
                                    <th className="text-center font-medium p-2 w-[80px]">Total</th>
                                    <th className="text-center font-medium p-2 w-[80px]">Status</th>
                                    <th className="text-center font-medium p-2 w-[100px]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="text-center p-8 text-muted-foreground">
                                            {accessLevel === 'self' ? 'No employee profile found for your account.' : 'No employees to display.'}
                                        </td>
                                    </tr>
                                ) : visibleEmployees.map(employee => {
                                    const empEntries = timeEntries.filter(te => te.employeeId === employee.id);
                                    const summary = calculatePayrollSummary(empEntries, employee, org?.payrollSettings?.overtimeRules, 'weekly');
                                    const weeklyTotal = summary.totalHours;
                                    const weeklyOT = summary.overtimeHours + summary.doubleTimeHours;
                                    const editable = canEditEmployee(employee);

                                    // Count statuses
                                    const draftCount = empEntries.filter(e => e.status === 'draft').length;
                                    const submittedCount = empEntries.filter(e => e.status === 'submitted').length;
                                    const approvedCount = empEntries.filter(e => e.status === 'approved').length;
                                    const rejectedCount = empEntries.filter(e => e.status === 'rejected').length;
                                    const processedCount = empEntries.filter(e => e.status === 'processed').length;
                                    const total = empEntries.length;

                                    const weekStatus = total === 0 ? null :
                                        processedCount === total ? 'processed' :
                                            approvedCount === total ? 'approved' :
                                                submittedCount === total ? 'submitted' :
                                                    draftCount === total ? 'draft' :
                                                        rejectedCount > 0 ? 'rejected' :
                                                            'mixed';

                                    const weekStatusLabel = weekStatus === 'mixed'
                                        ? `${draftCount > 0 ? `${draftCount} draft` : ''}${submittedCount > 0 ? ` ${submittedCount} sent` : ''}`.trim()
                                        : weekStatus === 'draft' ? 'Draft' : weekStatus;

                                    // Show submit button if employee has at least 1 draft entry
                                    const canSubmitRow = draftCount > 0 && editable;

                                    return (
                                        <tr key={employee.id} className="border-b hover:bg-muted/50 transition-colors">
                                            <td className="p-2 font-medium">
                                                <div className="flex flex-col">
                                                    <span className="flex items-center gap-1.5">
                                                        {employee.name}
                                                        {employee.id === myEmployeeRecord?.id && (
                                                            <Badge variant="outline" className="text-[9px] py-0 px-1">You</Badge>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground font-normal">{employee.role}</span>
                                                </div>
                                            </td>
                                            {weekDays.map(day => {
                                                const dayEntries = empEntries.filter(te => isSameDay(te.date.toDate(), day));
                                                const dayTotal = dayEntries.reduce((sum, e) => sum + e.totalHours, 0);
                                                const hasRejected = dayEntries.some(e => e.status === 'rejected');
                                                const allSubmitted = dayEntries.length > 0 && dayEntries.every(e => e.status === 'submitted' || e.status === 'approved' || e.status === 'processed');
                                                const allDraft = dayEntries.length > 0 && dayEntries.every(e => e.status === 'draft');

                                                return (
                                                    <td key={day.toISOString()} className={`p-1 text-center ${isSameDay(day, new Date()) ? 'bg-primary/5' : ''}`}>
                                                        <Button
                                                            variant="ghost"
                                                            className={`w-full h-10 ${hasRejected ? 'font-bold text-red-500 bg-red-50' :
                                                                allDraft && dayTotal > 0 ? 'font-bold text-foreground' :
                                                                    allSubmitted && dayTotal > 0 ? 'font-normal text-foreground/50' :
                                                                        dayTotal > 0 ? 'font-medium text-foreground/70' :
                                                                            'text-muted-foreground/30 hover:text-foreground'
                                                                } ${!editable ? 'cursor-default' : ''}`}
                                                            onClick={() => editable && handleOpenDetails(employee, day)}
                                                            disabled={!editable}
                                                        >
                                                            {dayTotal > 0 ? dayTotal.toFixed(1) : editable ? '+' : '—'}
                                                        </Button>
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 text-center font-bold text-lg">
                                                <div>{weeklyTotal.toFixed(1)}</div>
                                                {weeklyOT > 0 && (
                                                    <div className="text-[10px] text-amber-600 font-semibold">{weeklyOT.toFixed(1)} OT/DT</div>
                                                )}
                                            </td>
                                            <td className="p-2 text-center">
                                                {weekStatus && (
                                                    <Badge variant="outline" className={`text-[10px] capitalize ${weekStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        weekStatus === 'processed' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                                                            weekStatus === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                                                                weekStatus === 'submitted' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                                    weekStatus === 'mixed' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                                        'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                        {weekStatusLabel}
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-2 text-center">
                                                {canSubmitRow && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2 text-xs"
                                                        onClick={() => setConfirmSubmit({ employee, draftCount })}
                                                        disabled={submitEmployeeWeekMutation.isPending}
                                                        title="Submit this employee's week"
                                                    >
                                                        <Send className="h-3.5 w-3.5 mr-1" />
                                                        Submit
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <Dialog open={!!confirmSubmit} onOpenChange={(open) => !open && setConfirmSubmit(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Week for Approval?</DialogTitle>
                        <DialogDescription>
                            Are you sure you're ready to submit <strong>{confirmSubmit?.employee.name}</strong>'s timesheet for approval?
                            This will submit {confirmSubmit?.draftCount} draft {confirmSubmit?.draftCount === 1 ? 'entry' : 'entries'} for this week.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmSubmit(null)}>Cancel</Button>
                        <Button
                            onClick={() => confirmSubmit && submitEmployeeWeekMutation.mutate(confirmSubmit.employee.id)}
                            disabled={submitEmployeeWeekMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Yes, Submit Week
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {dialogState && (
                <TimeEntryDialog
                    open={dialogState.open}
                    onOpenChange={(open) => !open && setDialogState(null)}
                    employee={dialogState.employee}
                    date={dialogState.date}
                    existingEntries={timeEntries.filter(te =>
                        te.employeeId === dialogState.employee.id &&
                        isSameDay(te.date.toDate(), dialogState.date)
                    )}
                    crews={crews}
                />
            )}
        </div>
    );
}
