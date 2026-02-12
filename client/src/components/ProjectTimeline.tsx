import { useState, useMemo } from "react";
import { Project, ProjectEvent, Timestamp, projectOperations, quoteOperations, clientOperations } from "@/lib/firestore";
import { getDerivedStatus } from "@/lib/project-status";
import { getProjectTimelineEvents } from "@/lib/timelineUtils";
import { useUpdateProject } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Clock, CheckCircle2, AlertCircle, FileText, CalendarCheck, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { QuickAddDialog } from "./QuickAddDialog";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { ProjectDialog } from "@/components/ProjectDialog";

interface ProjectTimelineProps {
    project: Project & { id: string };
}

const EVENT_TYPES: { type: ProjectEvent['type']; label: string; color: string }[] = [
    { type: 'lead_created', label: 'Lead Created', color: 'bg-blue-500' },
    { type: 'quote_provided', label: 'Quote Provided', color: 'bg-purple-500' },
    { type: 'quote_created', label: 'Quote Created', color: 'bg-purple-500' },
    { type: 'quote_sent', label: 'Quote Sent', color: 'bg-indigo-500' },
    { type: 'quote_accepted', label: 'Quote Accepted', color: 'bg-emerald-500' },
    { type: 'scheduled', label: 'Booked', color: 'bg-indigo-500' },
    { type: 'started', label: 'Project Started', color: 'bg-blue-600' },
    { type: 'paused', label: 'Paused', color: 'bg-amber-500' },
    { type: 'resumed', label: 'Resumed', color: 'bg-blue-500' },
    { type: 'finished', label: 'Finished', color: 'bg-green-600' },
    { type: 'invoice_issued', label: 'Invoice Issued', color: 'bg-yellow-500' },
    { type: 'payment_received', label: 'Payment Received', color: 'bg-lime-500' },
    { type: 'on_hold', label: 'On Hold', color: 'bg-rose-500' },
    { type: 'custom', label: 'Custom Note', color: 'bg-cyan-500' },
];

export function ProjectTimeline({ project }: ProjectTimelineProps) {
    const updateProject = useUpdateProject();
    const [isOpen, setIsOpen] = useState(false);
    const [eventType, setEventType] = useState<ProjectEvent['type']>('custom');
    const [customLabel, setCustomLabel] = useState("");
    const [notes, setNotes] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // New additions
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [quickAddTab, setQuickAddTab] = useState("task");
    const [selectedTask, setSelectedTask] = useState<Project | null>(null);
    const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);

    // Fetch linked tasks
    const { data: linkedTasks = [] } = useQuery({
        queryKey: ['projects', 'linked', project.id],
        queryFn: () => projectOperations.getByLinkedProject(project.id),
        enabled: !!project.id
    });

    // Fetch Quotes for Timeline
    const { data: quotes = [] } = useQuery({
        queryKey: ['quotes', 'project', project.id],
        queryFn: () => quoteOperations.getByProject(project.id),
        enabled: !!project.id
    });

    // Fetch Client
    const { data: clientData } = useQuery({
        queryKey: ['client', project.clientId],
        queryFn: () => clientOperations.get(project.clientId),
        enabled: !!project.clientId
    });

    // Unified Timeline Events
    const unifiedEvents = useMemo(() => {
        return getProjectTimelineEvents(project, clientData, quotes);
    }, [project, clientData, quotes]);

    // Merge Tasks into Timeline
    const displayItems = useMemo(() => {
        // Filter out future events to clean up the view
        const visibleEvents = unifiedEvents.filter(e =>
            e.status === 'completed' ||
            e.status === 'pending' ||
            (e.status === 'future' && e.id === 'project_due') // Show due date target
        );

        const items: any[] = [...visibleEvents];

        // Merge manual notes/events
        const customEvents = (project.timeline || []).filter(e =>
            !['lead_created', 'project_created', 'quote_provided', 'quote_accepted', 'started', 'scheduled', 'finished', 'invoice_provided', 'invoice_paid'].includes(e.type)
        );

        customEvents.forEach(e => {
            items.push({
                id: e.id,
                label: e.label,
                date: e.date?.toDate ? e.date.toDate() : new Date(),
                status: 'completed',
                notes: e.notes,
                type: 'custom',
                order: 99 // Custom events go to bottom or sort by date? User said "static order".
                // Let's rely on date for custom events, but insert them relative to the static order if possible.
                // Actually, simply putting them at the end or mixing them by date might break the "static" feel.
                // For now, let's keep them sorted by date but AFTER the static structure if undefined.
                // Better approach: User wants static lines. Custom notes are extra.
            });
        });

        // Linked tasks
        linkedTasks.forEach(task => {
            items.push({
                isTask: true,
                id: task.id,
                date: task.startDate instanceof Timestamp ? task.startDate.toDate() : (task.startDate ? new Date(task.startDate) : null),
                label: task.name,
                type: task.type === 'appointment' ? 'appointment' : 'task',
                notes: task.notes,
                original: task,
                status: 'future',
                order: 99
            });
        });

        // Sort: Primary by Order (if exists), Secondary by Date
        return items.sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) {
                return a.order - b.order;
            }
            if (a.order !== undefined) {
                // a has order, b doesn't. a comes first.
                return -1;
            }
            if (b.order !== undefined) {
                // b has order, a doesn't. b comes first.
                return 1;
            }

            const dateA = a.date ? (a.date instanceof Date ? a.date.getTime() : a.date.toDate().getTime()) : 9999999999999;
            const dateB = b.date ? (b.date instanceof Date ? b.date.getTime() : b.date.toDate().getTime()) : 9999999999999;
            return dateA - dateB;
        });
    }, [unifiedEvents, project.timeline, linkedTasks]);

    const now = new Date();

    const handleAddEvent = async () => {
        const selectedType = EVENT_TYPES.find(t => t.type === eventType);
        const label = eventType === 'custom' ? (customLabel.trim() || 'Custom Note') : selectedType?.label || 'Event';

        // Create timestamp from input date using local time components to avoid UTC rollover
        const [y, m, d] = date.split('-').map(Number);
        const eventDate = new Date(y, m - 1, d, 12, 0, 0);

        const newEvent: ProjectEvent = {
            id: uuidv4(),
            type: eventType,
            label,
            date: Timestamp.fromDate(eventDate),
            notes,
        };

        const timeline = project.timeline || [];
        const newTimeline = [...timeline, newEvent];

        // Auto-update status mapping using time-aware logic
        const newStatus = getDerivedStatus(newTimeline, project.status, project.startDate, project.estimatedCompletion);

        await updateProject.mutateAsync({
            id: project.id,
            data: {
                timeline: newTimeline,
                status: newStatus
            }
        });

        setIsOpen(false);
        setNotes("");
        setCustomLabel("");
    };

    // Helper to format date safely
    const formatDate = (d: any) => {
        if (!d) return null;
        const dateObj = d.toDate ? d.toDate() : d;
        return format(dateObj, "MMM d, yyyy");
    };

    // Helper to navigate or execute action
    const handleAction = (action: any) => {
        if (action.link) {
            window.location.href = action.link; // Or use wouter location
        } else if (action.onClick) {
            action.onClick();
        } else if (action.label === 'Set Start' || action.label === 'ADD START DATE') {
            // handled via dialog trigger in render
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-col gap-3 py-4">
                <div className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Timeline</CardTitle>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setQuickAddTab('event'); setQuickAddOpen(true); }}>
                        <CalendarCheck className="h-4 w-4 mr-2" />
                        Add Event
                    </Button>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Note
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Timeline Note</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Event Type</Label>
                                    <Select
                                        value={eventType}
                                        onValueChange={(v) => setEventType(v as ProjectEvent['type'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {EVENT_TYPES.map(t => (
                                                <SelectItem key={t.type} value={t.type}>
                                                    {t.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {eventType === 'custom' && (
                                    <div className="grid gap-2">
                                        <Label>Label</Label>
                                        <Input
                                            value={customLabel}
                                            onChange={e => setCustomLabel(e.target.value)}
                                            placeholder="e.g. Permit Approved"
                                        />
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Notes</Label>
                                    <Textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Optional details..."
                                    />
                                </div>

                                <Button onClick={handleAddEvent}>Save Event</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pl-4 pr-1">
                <div className="relative border-l border-muted ml-2 space-y-6 pb-4">
                    {displayItems.length === 0 && (
                        <div className="text-sm text-muted-foreground pl-6 italic">No history yet.</div>
                    )}
                    {displayItems.map((event, i) => {
                        // Handle Task Items
                        if (event.isTask) {
                            const isPast = event.date && (event.date.seconds * 1000 < now.getTime());
                            return (
                                <div key={event.id} className={cn("relative pl-6 transition-opacity duration-300", isPast ? "opacity-90" : "")}>
                                    <div className={cn(
                                        "absolute -left-1.5 top-1 h-3 w-3 rounded-full shadow-sm ring-2 ring-background",
                                        event.type === 'appointment' ? 'bg-blue-500' : 'bg-green-500'
                                    )} />
                                    <div className="flex flex-col gap-1 cursor-pointer hover:bg-muted/10 p-1 rounded" onClick={() => { setSelectedTask(event.original); setTaskDetailsOpen(true); }}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {event.type === 'appointment' ? <Clock className="h-3 w-3 text-blue-500" /> : <FileText className="h-3 w-3 text-green-500" />}
                                                <span className="font-semibold text-sm">{event.label}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground mr-2">
                                                {event.date?.toDate ? format(event.date.toDate(), "MMM d, yyyy") : "TBD"}
                                            </span>
                                        </div>
                                        {event.notes && (
                                            <p className="text-xs text-muted-foreground bg-muted p-2 rounded truncate max-w-[300px]">
                                                {event.notes}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // Handle Standard Events
                        const typeDef = EVENT_TYPES.find(t => t.type === event.type) || EVENT_TYPES[EVENT_TYPES.length - 1];
                        // Convert Timestamp or Date to Date object for comparison
                        const eventDateObj = event.date ? (event.date.toDate ? event.date.toDate() : event.date) : null;
                        const isPast = eventDateObj ? eventDateObj.getTime() < now.getTime() : false;

                        // Check if actionable pending item
                        const isActionable = event.action && event.status === 'pending';

                        return (
                            <div key={event.id} className={cn("relative pl-6 transition-opacity duration-300", isPast ? "opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0" : "")}>
                                <div className={cn(
                                    "absolute -left-1.5 top-1 h-3 w-3 rounded-full shadow-sm ring-2 ring-background",
                                    isActionable ? "bg-red-500 animate-pulse" : (typeDef.color || "bg-gray-400")
                                )} />
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between min-h-[24px]">
                                        {isActionable ? (
                                            /* ACTION BUTTON REPLACEMENT */
                                            event.action.label === 'Set Start' || event.action.label === 'ADD START DATE' ? (
                                                <ProjectDialog
                                                    project={project}
                                                    mode="edit"
                                                    trigger={
                                                        <Button variant="destructive" size="sm" className="h-8 px-4 text-xs w-full justify-center">
                                                            {event.action.label}
                                                        </Button>
                                                    }
                                                />
                                            ) : event.action.label === 'Set Due Date' || event.action.label === 'SET DUE DATE' ? (
                                                <ProjectDialog
                                                    project={project}
                                                    mode="edit"
                                                    trigger={
                                                        <Button variant="destructive" size="sm" className="h-8 px-4 text-xs w-full justify-center">
                                                            {event.action.label}
                                                        </Button>
                                                    }
                                                />
                                            ) : (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-8 px-4 text-xs font-bold w-full justify-center" // "attention grabbing"
                                                    onClick={() => handleAction(event.action)}
                                                >
                                                    {event.action.label}
                                                </Button>
                                            )
                                        ) : (
                                            /* NORMAL LABEL */
                                            <span className={cn("font-semibold text-sm", !isPast && "text-primary")}>{event.label}</span>
                                        )}

                                        {!isActionable && (
                                            <span className="text-xs text-muted-foreground mr-2">
                                                {formatDate(event.date) || (event.status === 'pending' ? "Pending" : "")}
                                            </span>
                                        )}
                                    </div>
                                    {event.notes && (
                                        <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                            {event.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            <QuickAddDialog
                open={quickAddOpen}
                onOpenChange={setQuickAddOpen}
                initialLinkedProjectId={project.id}
                defaultTab={quickAddTab}
                hiddenTabs={['project']}
                onSuccess={() => { /* maybe invalidate query */ }}
            />
            <TaskDetailsDialog
                open={taskDetailsOpen}
                onOpenChange={setTaskDetailsOpen}
                task={selectedTask}
            />
        </Card>
    );
}
