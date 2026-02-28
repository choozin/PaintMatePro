import { useState, useEffect, useMemo } from "react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectOperations, timeEntryOperations, Employee, TimeEntry, Project, Crew } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Timestamp } from "firebase/firestore";
import { Plus, Trash2, Clock, AlertCircle, Lock, Send, RotateCcw } from "lucide-react";
import { format, isAfter, startOfDay, isBefore, isSameDay } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface TimeEntryDialogProps {
    employee: Employee;
    date: Date;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    existingEntries: TimeEntry[];
    crews: Crew[];
}

// Custom project ID prefix for freeform entries
const CUSTOM_PROJECT_PREFIX = '_custom_';

export function TimeEntryDialog({ employee, date, open, onOpenChange, existingEntries, crews }: TimeEntryDialogProps) {
    const { org, user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [entries, setEntries] = useState<Partial<TimeEntry & { customProjectName?: string }>[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Validation States
    const isFuture = isAfter(startOfDay(date), startOfDay(new Date()));
    const isApproved = existingEntries.some(e => e.status === 'approved' || e.status === 'processed');
    const isRejected = existingEntries.some(e => e.status === 'rejected');
    const isSubmitted = existingEntries.some(e => e.status === 'submitted');

    // Rejected entries CAN be edited (and resubmitted), approved/processed cannot
    const canEdit = !isFuture && !isApproved && !isSubmitted;

    // Fetch all Projects
    const { data: allProjects = [] } = useQuery({
        queryKey: ['projects', org?.id],
        queryFn: () => projectOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    // Helper: convert Timestamp or string to Date
    const toDate = (input: any): Date | null => {
        if (!input) return null;
        if (input instanceof Timestamp) return input.toDate();
        if (typeof input === 'string') return new Date(input);
        if (input?.toDate) return input.toDate();
        return null;
    };

    // Filter projects to show only those scheduled for this date
    const scheduledProjects = useMemo(() => {
        return allProjects.filter(p => {
            // Always include active projects without dates (general jobs)
            if (!p.startDate) return ['in-progress', 'started', 'active', 'scheduled', 'booked'].includes(p.status);

            const start = toDate(p.startDate);
            const end = toDate(p.estimatedCompletion) || toDate(p.startDate); // If no end date, treat as same-day

            if (!start) return false;

            // Check if the target date falls within the project's scheduled range
            const targetDate = startOfDay(date);
            const startDay = startOfDay(start);
            const endDay = end ? startOfDay(end) : startDay;

            return targetDate >= startDay && targetDate <= endDay;
        });
    }, [allProjects, date]);

    useEffect(() => {
        if (open) {
            setValidationErrors([]);
            if (existingEntries.length > 0) {
                setEntries(existingEntries.map(e => {
                    // Detect custom project entries and parse out the name
                    if (e.projectId?.startsWith(CUSTOM_PROJECT_PREFIX)) {
                        return {
                            ...e,
                            customProjectName: e.projectId.replace(CUSTOM_PROJECT_PREFIX, ''),
                            projectId: CUSTOM_PROJECT_PREFIX
                        };
                    }
                    return { ...e };
                }));
            } else {
                const employeeCrew = crews.find(c => (c.memberIds || []).includes(employee.id));
                const defaultProject = scheduledProjects.find(p =>
                    p.assignedCrewId === employeeCrew?.id
                );

                setEntries([{
                    projectId: defaultProject?.id || '',
                    startTime: undefined,
                    endTime: undefined,
                    totalHours: 0,
                    workType: 'regular'
                }]);
            }
        }
    }, [open, existingEntries, crews, employee.id, scheduledProjects]);

    const addEntry = () => {
        const employeeCrew = crews.find(c => (c.memberIds || []).includes(employee.id));
        const defaultProject = scheduledProjects.find(p =>
            p.assignedCrewId === employeeCrew?.id
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

    const updateEntry = (index: number, field: string, value: any) => {
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
        setValidationErrors([]); // Clear errors on edit
    };

    // Validation
    const validate = (): boolean => {
        const errors: string[] = [];
        entries.forEach((entry, i) => {
            const hasProject = entry.projectId && entry.projectId !== '';
            const hasCustomName = entry.projectId === CUSTOM_PROJECT_PREFIX && entry.customProjectName?.trim();
            if (!hasProject && !hasCustomName) {
                errors.push(`Entry ${i + 1}: Please select a project or enter a custom job name.`);
            }
            if (!entry.totalHours || entry.totalHours <= 0) {
                errors.push(`Entry ${i + 1}: Hours must be greater than 0.`);
            }
        });
        setValidationErrors(errors);
        return errors.length === 0;
    };

    const saveMutation = useMutation({
        mutationFn: async (submitAfterSave?: boolean) => {
            const existingIds = existingEntries.map(e => e.id);
            const currentIds = entries.filter(e => e.id).map(e => e.id!);

            const toDelete = existingIds.filter(id => !currentIds.includes(id));

            const promises: Promise<any>[] = [];

            // Delete removed entries
            for (const id of toDelete) {
                promises.push(timeEntryOperations.delete(id));
            }

            // Upsert entries
            for (const entry of entries) {
                // Skip entries with no project AND no custom name AND no hours
                const projectId = entry.projectId === CUSTOM_PROJECT_PREFIX
                    ? `${CUSTOM_PROJECT_PREFIX}${entry.customProjectName?.trim() || 'Other'}`
                    : entry.projectId;

                if (!projectId || !entry.totalHours || entry.totalHours <= 0) continue;

                const newStatus = submitAfterSave ? 'submitted' : (entry.status === 'rejected' ? 'draft' : (entry.status || 'draft'));

                const data = {
                    ...entry,
                    orgId: org!.id,
                    employeeId: employee.id,
                    projectId,
                    date: Timestamp.fromDate(date),
                    status: newStatus,
                    updatedAt: Timestamp.now(),
                    ...(submitAfterSave ? { rejectedBy: null, rejectionNotes: null } : {})
                } as any;

                // Remove the custom field before saving
                delete data.customProjectName;

                if (entry.id) {
                    promises.push(timeEntryOperations.update(entry.id, data));
                } else {
                    data.createdAt = Timestamp.now();
                    data.status = submitAfterSave ? 'submitted' : 'draft';
                    promises.push(timeEntryOperations.create(data));
                }
            }

            await Promise.all(promises);
        },
        onSuccess: (_data, submitAfterSave) => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            onOpenChange(false);
            toast({
                title: submitAfterSave ? "Submitted for Approval" : "Time Log Saved",
                description: submitAfterSave
                    ? "Your timesheet has been submitted and is awaiting approval."
                    : "Your time entry has been saved as a draft.",
            });
        },
        onError: () => {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save time entry. Please try again.",
            });
        }
    });

    const handleSave = (submit: boolean) => {
        if (!validate()) return;
        saveMutation.mutate(submit);
    };

    // Get rejection notes if any
    const rejectionNotes = existingEntries.find(e => e.rejectionNotes)?.rejectionNotes;

    const totalHours = entries.reduce((sum, e) => sum + (e.totalHours || 0), 0);

    // Helper to get project name from ID (for display)
    const getProjectName = (projectId?: string) => {
        if (!projectId) return '';
        if (projectId.startsWith(CUSTOM_PROJECT_PREFIX)) return projectId.replace(CUSTOM_PROJECT_PREFIX, '');
        return allProjects.find(p => p.id === projectId)?.name || projectId;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Log Time: {employee.name}
                        {isSubmitted && <Badge className="bg-blue-100 text-blue-700 border-blue-200">Submitted</Badge>}
                        {isApproved && <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>}
                        {isRejected && <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>}
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

                {isApproved && !isFuture && (
                    <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                        <Lock className="h-4 w-4" />
                        <AlertTitle>Approved</AlertTitle>
                        <AlertDescription>This timesheet has been approved and is locked for editing.</AlertDescription>
                    </Alert>
                )}

                {isSubmitted && !isFuture && (
                    <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                        <Send className="h-4 w-4" />
                        <AlertTitle>Submitted</AlertTitle>
                        <AlertDescription>This timesheet has been submitted for approval. It cannot be edited until it is approved or rejected.</AlertDescription>
                    </Alert>
                )}

                {isRejected && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                        <RotateCcw className="h-4 w-4" />
                        <AlertTitle>Rejected — Please Revise</AlertTitle>
                        <AlertDescription>
                            {rejectionNotes || 'This timesheet was rejected. Please make corrections and resubmit.'}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Please fix the following</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    {entries.map((entry, index) => (
                        <div key={index} className={`grid grid-cols-12 gap-3 items-end border p-3 rounded-lg relative ${entry.status === 'rejected' ? 'bg-red-50/50 border-red-200' : 'bg-muted/10'
                            }`}>
                            {/* Project Select */}
                            <div className="col-span-12 sm:col-span-5 space-y-1">
                                <Label className="text-xs">Project / Job</Label>
                                <Select
                                    value={entry.projectId || ''}
                                    onValueChange={(val) => updateEntry(index, 'projectId', val)}
                                    disabled={!canEdit}
                                >
                                    <SelectTrigger className={!entry.projectId ? 'border-red-300' : ''}>
                                        <SelectValue placeholder="Select Project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {scheduledProjects.length > 0 && (
                                            <>
                                                {scheduledProjects.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </>
                                        )}
                                        {/* Show the currently selected project if it's not in scheduled list (e.g. existing entry from another date) */}
                                        {entry.projectId && !entry.projectId.startsWith(CUSTOM_PROJECT_PREFIX) && !scheduledProjects.find(p => p.id === entry.projectId) && (
                                            <SelectItem value={entry.projectId}>
                                                {getProjectName(entry.projectId)} (not scheduled today)
                                            </SelectItem>
                                        )}
                                        <SelectItem value={CUSTOM_PROJECT_PREFIX}>
                                            ✏️ Custom / Other...
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* Custom job name input */}
                                {entry.projectId === CUSTOM_PROJECT_PREFIX && (
                                    <Input
                                        placeholder="Enter custom job name..."
                                        value={entry.customProjectName || ''}
                                        onChange={(e) => updateEntry(index, 'customProjectName', e.target.value)}
                                        className="mt-1"
                                        disabled={!canEdit}
                                    />
                                )}
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
                                        className={`pl-8 ${(!entry.totalHours || entry.totalHours <= 0) ? 'border-red-300' : ''}`}
                                        value={entry.totalHours || ''}
                                        onChange={(e) => updateEntry(index, 'totalHours', parseFloat(e.target.value) || 0)}
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
                            Total: {totalHours.toFixed(1)} hrs
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                {canEdit ? 'Cancel' : 'Close'}
                            </Button>
                            {canEdit && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleSave(false)}
                                        disabled={saveMutation.isPending}
                                    >
                                        Save Draft
                                    </Button>
                                    <Button
                                        onClick={() => handleSave(true)}
                                        disabled={saveMutation.isPending}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {isRejected ? 'Resubmit' : 'Submit'}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
