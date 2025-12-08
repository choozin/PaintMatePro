import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { employeeOperations, timeEntryOperations, Employee, TimeEntry } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, subWeeks, addDays, isWithinInterval } from "date-fns";
import { Download, CheckCircle, AlertCircle, Calendar as CalendarIcon, DollarSign, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { RoleGuard } from "@/components/RoleGuard";

interface EmployeePayrollSummary {
    employee: Employee;
    regularHours: number;
    overtimeHours: number; // >40/wk or based on type
    totalHours: number;
    grossPay: number;
    status: 'draft' | 'submitted' | 'approved' | 'processed' | 'mixed';
    entries: TimeEntry[];
}

export default function Payroll() {
    const { org } = useAuth();
    const queryClient = useQueryClient();

    // Default to last week
    const [dateRange, setDateRange] = useState({
        start: startOfWeek(subWeeks(new Date(), 1)),
        end: endOfWeek(subWeeks(new Date(), 1))
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees', org?.id],
        queryFn: () => employeeOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    const { data: timeEntries = [] } = useQuery({
        queryKey: ['timeEntries', org?.id],
        queryFn: () => timeEntryOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    // Process Data
    const payrollData: EmployeePayrollSummary[] = employees.map(emp => {
        const empEntries = timeEntries.filter(te => {
            if (te.employeeId !== emp.id) return false;
            const d = te.date.toDate();
            return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
        });

        let regularHours = 0;
        let overtimeHours = 0;
        let totalHours = 0;

        // Simple calculation logic: strictly by workType for now
        // Advanced logic would sum weekly hours and apply OT rules
        empEntries.forEach(e => {
            totalHours += e.totalHours;
            if (e.workType === 'overtime' || e.workType === 'double_time') {
                overtimeHours += e.totalHours;
            } else {
                regularHours += e.totalHours;
            }
        });

        const rate = emp.hourlyRate || 0;
        // Simple OT = 1.5x
        const grossPay = (regularHours * rate) + (overtimeHours * rate * 1.5);

        // Determine aggregated status
        const statuses = empEntries.map(e => e.status);
        let status: EmployeePayrollSummary['status'] = 'draft';
        if (empEntries.length === 0) status = 'draft';
        else if (statuses.every(s => s === 'processed')) status = 'processed';
        else if (statuses.every(s => s === 'approved' || s === 'processed')) status = 'approved';
        else if (statuses.some(s => s === 'draft')) status = 'draft'; // If any draft, essentially draft
        else status = 'submitted';

        return {
            employee: emp,
            regularHours,
            overtimeHours,
            totalHours,
            grossPay,
            status,
            entries: empEntries
        };
    }).filter(d => d.totalHours > 0); // Only show active employees

    // Mutations
    const approveMutation = useMutation({
        mutationFn: async (filteredData: EmployeePayrollSummary[]) => {
            const promises = [];
            for (const item of filteredData) {
                for (const entry of item.entries) {
                    if (entry.status === 'draft' || entry.status === 'submitted') {
                        promises.push(timeEntryOperations.update(entry.id, {
                            status: 'approved',
                            approvedAt: Timestamp.now()
                        }));
                    }
                }
            }
            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
        }
    });

    const handleExport = () => {
        // Generate CSV
        const headers = ["Employee ID", "Employee Name", "Date", "Project ID", "Hours", "Work Type", "Rate", "Total Pay", "Status"];
        const rows: string[] = [];

        payrollData.forEach(p => {
            p.entries.forEach(e => {
                const rate = p.employee.hourlyRate || 0;
                const multiplier = e.workType === 'overtime' ? 1.5 : e.workType === 'double_time' ? 2.0 : 1.0;
                const pay = e.totalHours * rate * multiplier;

                rows.push([
                    p.employee.id,
                    p.employee.name,
                    format(e.date.toDate(), 'yyyy-MM-dd'),
                    e.projectId,
                    e.totalHours,
                    e.workType,
                    rate,
                    pay.toFixed(2),
                    e.status
                ].join(","));
            });
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `payroll_export_${format(dateRange.start, 'yyyyMMdd')}_${format(dateRange.end, 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalPayrollCost = payrollData.reduce((acc, curr) => acc + curr.grossPay, 0);
    const totalHoursLog = payrollData.reduce((acc, curr) => acc + curr.totalHours, 0);

    return (
        <RoleGuard permission="view_payroll" fallback={<div className="p-8 text-center">You do not have permission to view payroll.</div>}>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Payroll Dashboard</h1>
                        <p className="text-muted-foreground">Manage approvals and export to payroll.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setDateRange({
                            start: subWeeks(dateRange.start, 1),
                            end: subWeeks(dateRange.end, 1)
                        })}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center border rounded-md px-3 py-2 bg-background">
                            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                                {format(dateRange.start, "MMM d")} - {format(dateRange.end, "MMM d, yyyy")}
                            </span>
                        </div>
                        <Button variant="outline" onClick={() => setDateRange({
                            start: addDays(dateRange.start, 7),
                            end: addDays(dateRange.end, 7)
                        })}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" className="ml-2" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Est. Gross Payroll</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${totalPayrollCost.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground">For current period</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalHoursLog.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground">Logged hours</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {payrollData.filter(p => p.status === 'draft' || p.status === 'submitted').length} Employees
                            </div>
                            <p className="text-xs text-muted-foreground">Needs review</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Employee Summary</CardTitle>
                        <CardDescription>Review and approve timesheets before export.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left font-medium p-3">Employee</th>
                                        <th className="text-center font-medium p-3">Reg Hrs</th>
                                        <th className="text-center font-medium p-3">OT Hrs</th>
                                        <th className="text-center font-medium p-3">Total</th>
                                        <th className="text-right font-medium p-3">Gross Pay</th>
                                        <th className="text-center font-medium p-3">Status</th>
                                        <th className="text-right font-medium p-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrollData.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center p-8 text-muted-foreground">
                                                No time entries found for this period.
                                            </td>
                                        </tr>
                                    ) : payrollData.map(item => (
                                        <tr key={item.employee.id} className="border-b hover:bg-muted/50">
                                            <td className="p-3 font-medium">
                                                <div>{item.employee.name}</div>
                                                <div className="text-xs text-muted-foreground">{item.employee.role}</div>
                                            </td>
                                            <td className="text-center p-3">{item.regularHours.toFixed(1)}</td>
                                            <td className="text-center p-3">{item.overtimeHours.toFixed(1)}</td>
                                            <td className="text-center p-3 font-bold">{item.totalHours.toFixed(1)}</td>
                                            <td className="text-right p-3">${item.grossPay.toFixed(2)}</td>
                                            <td className="text-center p-3">
                                                <Badge variant={
                                                    item.status === 'approved' ? 'default' :
                                                        item.status === 'processed' ? 'secondary' : 'outline'
                                                } className={item.status === 'draft' ? 'text-orange-500 border-orange-200' : ''}>
                                                    {item.status === 'draft' ? 'Pending' : item.status}
                                                </Badge>
                                            </td>
                                            <td className="text-right p-3">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    disabled={item.status === 'approved' || item.status === 'processed'}
                                                    onClick={() => approveMutation.mutate([item])}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                    Approve
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </RoleGuard>
    );
}
