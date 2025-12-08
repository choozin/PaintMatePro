import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { employeeOperations, crewOperations, projectOperations, timeEntryOperations } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { TimeEntryDialog } from "@/components/TimeEntryDialog";

export default function TimeTracking() {
    const { org } = useAuth();
    const queryClient = useQueryClient();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCrewId, setSelectedCrewId] = useState<string>("all");
    const [dialogState, setDialogState] = useState<{ open: boolean; employee: any; date: Date } | null>(null);

    // Get week range
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start
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
            // Fetch typically by Org for simplicity in V1, or date range query if large
            const all = await timeEntryOperations.getByOrg(org!.id);
            // Client side filter for week for now (optimize later)
            return all.filter(te => {
                const d = te.date.toDate();
                return d >= weekStart && d <= addDays(weekStart, 6);
            });
        },
        enabled: !!org,
    });

    // Filter Employees based on Crew Selection
    const visibleEmployees = selectedCrewId === "all"
        ? employees
        : employees.filter(e => {
            const crew = crews.find(c => c.id === selectedCrewId);
            return crew?.memberIds.includes(e.id);
        });

    const navigateWeek = (direction: 'prev' | 'next') => {
        setCurrentDate(addDays(currentDate, direction === 'next' ? 7 : -7));
    };

    const handleOpenDetails = (employee: any, date: Date) => {
        setDialogState({ open: true, employee, date });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Time Tracking</h1>
                    <p className="text-muted-foreground">Manage weekly hours and split shifts.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Crew" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Employees</SelectItem>
                            {crews.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="w-32 text-center font-medium">
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
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left font-medium p-2 w-[200px]">Employee</th>
                                    {weekDays.map(day => (
                                        <th key={day.toISOString()} className={`text-center font-medium p-2 ${isSameDay(day, new Date()) ? 'bg-muted/50 rounded-t-md text-primary' : ''}`}>
                                            <div className="text-xs text-muted-foreground uppercase">{format(day, "EEE")}</div>
                                            <div>{format(day, "d")}</div>
                                        </th>
                                    ))}
                                    <th className="text-center font-medium p-2 w-[100px]">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleEmployees.map(employee => {
                                    const empEntries = timeEntries.filter(te => te.employeeId === employee.id);
                                    const weeklyTotal = empEntries.reduce((sum, e) => sum + e.totalHours, 0);

                                    return (
                                        <tr key={employee.id} className="border-b hover:bg-muted/50 transition-colors">
                                            <td className="p-2 font-medium">
                                                <div className="flex flex-col">
                                                    <span>{employee.name}</span>
                                                    <span className="text-xs text-muted-foreground font-normal">{employee.role}</span>
                                                </div>
                                            </td>
                                            {weekDays.map(day => {
                                                const dayEntries = empEntries.filter(te => isSameDay(te.date.toDate(), day));
                                                const dayTotal = dayEntries.reduce((sum, e) => sum + e.totalHours, 0);

                                                return (
                                                    <td key={day.toISOString()} className={`p-1 text-center ${isSameDay(day, new Date()) ? 'bg-muted/20' : ''}`}>
                                                        <Button
                                                            variant="ghost"
                                                            className={`w-full h-10 ${dayTotal > 0 ? 'font-bold text-foreground' : 'text-muted-foreground/30 hover:text-foreground'}`}
                                                            onClick={() => handleOpenDetails(employee, day)}
                                                        >
                                                            {dayTotal > 0 ? dayTotal.toFixed(1) : '+'}
                                                        </Button>
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 text-center font-bold text-lg">
                                                {weeklyTotal.toFixed(1)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

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
