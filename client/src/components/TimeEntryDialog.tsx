import { useState, useEffect } from "react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectOperations, timeEntryOperations, Employee, TimeEntry, Project, Crew } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Timestamp } from "firebase/firestore";
import { Plus, Trash2, Clock, AlertCircle, Lock } from "lucide-react";
import { format, isAfter, startOfDay, isBefore } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface TimeEntryDialogProps {
    employee: Employee;
    date: Date;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    existingEntries: TimeEntry[];
    crews: Crew[];
}

export function TimeEntryDialog({ employee, date, open, onOpenChange, existingEntries, crews }: TimeEntryDialogProps) {
    const { org } = useAuth();
    const queryClient = useQueryClient();
    const [entries, setEntries] = useState<Partial<TimeEntry>[]>([]);

    // Validation States
    const isFuture = isAfter(startOfDay(date), startOfDay(new Date()));
    const isLocked = existingEntries.some(e => e.status === 'approved' || e.status === 'processed');
    const canEdit = !isFuture && !isLocked;

    // Fetch Projects
    const { data: projects = [] } = useQuery({
        queryKey: ['projects', org?.id],
        queryFn: () => projectOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    useEffect(() => {
        if (open) {
            if (existingEntries.length > 0) {
                setEntries(existingEntries.map(e => ({ ...e })));
            } else {
                // Find default project based on crew assignment
                const employeeCrew = crews.find(c => c.memberIds.includes(employee.id));
                // Find an active project assigned to this crew
                const defaultProject = projects.find(p =>
                    p.assignedCrewId === employeeCrew?.id &&
                    ['in-progress', 'started', 'scheduled'].includes(p.status)
                );

                // Initialize with default
                setEntries([{
                    projectId: defaultProject?.id || '',
                    startTime: undefined,
                    endTime: undefined,
                    totalHours: 0,
                    workType: 'regular'
                }]);
            }
        }
    }, [open, existingEntries, crews, employee.id, projects]); // Note: projects dependency might cause reset if it loads late, but typically cached

    const addEntry = () => {
        // smart default for new split entries too
        const employeeCrew = crews.find(c => c.memberIds.includes(employee.id));
        const defaultProject = projects.find(p =>
            p.assignedCrewId === employeeCrew?.id &&
            ['in-progress', 'started', 'scheduled'].includes(p.status)
        );

        setEntries([...entries, {
            projectId: defaultProject?.id || '',
            totalHours: 0,
            workType: 'regular'
        }]);
    };

    const removeEntry = (index: number) => {
        const newEntries = [...entries];
        newEntries.splice(index, 1);
        setEntries(newEntries);
    };

    const updateEntry = (index: number, field: keyof TimeEntry, value: any) => {
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const existingIds = existingEntries.map(e => e.id);
            const currentIds = entries.filter(e => e.id).map(e => e.id!);

            const toDelete = existingIds.filter(id => !currentIds.includes(id));

            // DB Ops
            const promises = [];

            // Delete
            for (const id of toDelete) {
                promises.push(timeEntryOperations.delete(id));
            }

            // Upsert
            for (const entry of entries) {
                // Skip invalid entries
                if (!entry.projectId || !entry.totalHours) continue;

                const data = {
                    ...entry,
                    orgId: org!.id,
                    employeeId: employee.id,
                    date: Timestamp.fromDate(date),
                    updatedAt: Timestamp.now()
                } as any;

                if (entry.id) {
                    promises.push(timeEntryOperations.update(entry.id, data));
                } else {
                    data.createdAt = Timestamp.now();
                    data.status = 'draft'; // Always starts as draft
                    promises.push(timeEntryOperations.create(data));
                }
            }

            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            onOpenChange(false);
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        Log Time: {employee.name}
                    </DialogTitle>
                    <DialogDescription>
                        {format(date, "EEEE, MMMM do, yyyy")}
                    </DialogDescription>
                </DialogHeader>

                {/* Validation Banners */}
                {isFuture && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Future Date</AlertTitle>
                        <AlertDescription>You cannot enter time logs for future dates.</AlertDescription>
                    </Alert>
                )}

                {isLocked && !isFuture && (
                    <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                        <Lock className="h-4 w-4" />
                        <AlertTitle>Approved</AlertTitle>
                        <AlertDescription>This timesheet has been approved and is locked for editing.</AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    {entries.map((entry, index) => (
                        <div key={index} className="grid grid-cols-12 gap-3 items-end border p-3 rounded-lg bg-muted/10 relative">
                            {/* Project Select */}
                            <div className="col-span-12 sm:col-span-5 space-y-1">
                                <Label className="text-xs">Project / Job</Label>
                                <Select
                                    value={entry.projectId}
                                    onValueChange={(val) => updateEntry(index, 'projectId', val)}
                                    disabled={!canEdit}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Work Type */}
                            <div className="col-span-6 sm:col-span-3 space-y-1">
                                <Label className="text-xs">Type</Label>
                                <Select
                                    value={entry.workType || 'regular'}
                                    onValueChange={(val) => updateEntry(index, 'workType', val)}
                                    disabled={!canEdit}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="regular">Regular</SelectItem>
                                        <SelectItem value="overtime">Overtime</SelectItem>
                                        <SelectItem value="travel">Travel</SelectItem>
                                        <SelectItem value="double_time">Double Time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Hours */}
                            <div className="col-span-4 sm:col-span-3 space-y-1">
                                <Label className="text-xs">Hours</Label>
                                <div className="relative">
                                    <Clock className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        step="0.5"
                                        className="pl-8"
                                        value={entry.totalHours || ''}
                                        onChange={(e) => updateEntry(index, 'totalHours', parseFloat(e.target.value))}
                                        disabled={!canEdit}
                                    />
                                </div>
                            </div>

                            {/* Delete */}
                            <div className="col-span-2 sm:col-span-1 pb-1">
                                {entries.length > 0 && canEdit && (
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeEntry(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    {canEdit && (
                        <Button variant="outline" className="w-full border-dashed" onClick={addEntry}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Split Shift / Job
                        </Button>
                    )}
                </div>

                <DialogFooter>
                    <div className="flex-1 flex justify-between items-center text-sm font-medium">
                        <span className="text-muted-foreground">
                            Total: {entries.reduce((sum, e) => sum + (e.totalHours || 0), 0).toFixed(1)} hrs
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                {canEdit ? 'Cancel' : 'Close'}
                            </Button>
                            {canEdit && (
                                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                                    Save Time Log
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
