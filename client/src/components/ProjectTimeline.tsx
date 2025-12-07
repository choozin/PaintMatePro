import { useState } from "react";
import { Project, ProjectEvent, Timestamp } from "@/lib/firestore";
import { getDerivedStatus } from "@/lib/project-status";
import { useUpdateProject } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { ProjectDialog } from "@/components/ProjectDialog";

interface ProjectTimelineProps {
    project: Project & { id: string };
}

const EVENT_TYPES: { type: ProjectEvent['type']; label: string; color: string }[] = [
    { type: 'lead_created', label: 'Lead Created', color: 'bg-blue-500' },
    { type: 'quote_provided', label: 'Quote Provided', color: 'bg-purple-500' },
    { type: 'quote_accepted', label: 'Quote Accepted', color: 'bg-emerald-500' },
    { type: 'scheduled', label: 'Booked', color: 'bg-indigo-500' },
    { type: 'started', label: 'Project Started', color: 'bg-blue-600' },
    { type: 'paused', label: 'Paused', color: 'bg-amber-500' },
    { type: 'resumed', label: 'Resumed', color: 'bg-blue-500' },
    { type: 'finished', label: 'Finished', color: 'bg-green-600' },
    { type: 'invoice_issued', label: 'Invoice Issued', color: 'bg-yellow-500' },
    { type: 'payment_received', label: 'Payment Received', color: 'bg-lime-500' },
    { type: 'custom', label: 'Custom Note', color: 'bg-cyan-500' },
];

export function ProjectTimeline({ project }: ProjectTimelineProps) {
    // ... (state hooks remain same) ...
    const updateProject = useUpdateProject();
    const [isOpen, setIsOpen] = useState(false);
    const [eventType, setEventType] = useState<ProjectEvent['type']>('custom');
    const [customLabel, setCustomLabel] = useState("");
    const [notes, setNotes] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Implicitly add core events if they don't exist in the timeline
    const timeline = [...(project.timeline || [])];

    // ... (implicit event logic remains same) ...
    // 1. Lead Created...
    if (!timeline.some(e => e.type === 'lead_created')) {
        timeline.push({
            id: 'implicit-lead',
            type: 'lead_created',
            label: 'Lead Created',
            date: project.createdAt || null as any,
            notes: 'Project created'
        });
    }

    if (!timeline.some(e => e.type === 'started') && project.startDate) {
        timeline.push({
            id: 'implicit-start',
            type: 'started',
            label: 'Project Started',
            date: project.startDate,
            notes: 'Booked start date'
        });
    }

    const hasDueDate = timeline.some(e => e.label === 'Project Due');

    if (!hasDueDate && project.estimatedCompletion) {
        timeline.push({
            id: 'implicit-due',
            type: 'scheduled',
            label: 'Project Due',
            date: project.estimatedCompletion,
            notes: 'Estimated completion date'
        });
    } else if (!hasDueDate && !project.estimatedCompletion) {
        timeline.push({
            id: 'implicit-due-unknown',
            type: 'scheduled',
            label: 'Project Due',
            date: null as any,
            notes: 'Date not set'
        });
    }

    // Sort ASCENDING (Past -> Future)
    const sortedTimeline = timeline.sort((a, b) => {
        const dateA = a.date?.seconds || 0;
        const dateB = b.date?.seconds || 0;
        return dateA - dateB;
    });

    const now = new Date();

    // ... (handleAddEvent remains same) ...
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



        // ... inside handleAddEvent ...

        const newTimeline = [...timeline, newEvent];

        // Auto-update status mapping using time-aware logic
        const newStatus = getDerivedStatus(newTimeline, project.status, !!project.startDate);

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

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-lg">Timeline</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    {/* ... (Dialog trigger/content same) ... */}
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Event
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Timeline Event</DialogTitle>
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
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pl-4 pr-1">
                <div className="relative border-l border-muted ml-2 space-y-6 pb-4">
                    {sortedTimeline.length === 0 && (
                        <div className="text-sm text-muted-foreground pl-6 italic">No history yet.</div>
                    )}
                    {sortedTimeline.map((event, i) => {
                        const typeDef = EVENT_TYPES.find(t => t.type === event.type) || EVENT_TYPES[EVENT_TYPES.length - 1];

                        // Check if event is in the past
                        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(); // timestamp to date
                        const isPast = eventDate.getTime() < now.getTime();

                        return (
                            <div key={event.id} className={cn("relative pl-6 transition-opacity duration-300", isPast ? "opacity-60 grayscale-[50%] hover:opacity-100 hover:grayscale-0" : "")}>
                                <div className={cn(
                                    "absolute -left-1.5 top-1 h-3 w-3 rounded-full shadow-sm ring-2 ring-background",
                                    typeDef.color // Use brightness directly from updated array
                                )} />
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm">{event.label}</span>
                                        {event.id === 'implicit-due-unknown' ? (
                                            <ProjectDialog
                                                project={project}
                                                mode="edit"
                                                trigger={
                                                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-red-500 hover:text-red-700 font-medium">
                                                        End date not specified. Add now
                                                    </Button>
                                                }
                                            />
                                        ) : (
                                            <span className="text-xs text-muted-foreground mr-2">
                                                {event.date?.toDate ? format(event.date.toDate(), "MMM d, yyyy") : "Unknown Date"}
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
        </Card>
    );
}
