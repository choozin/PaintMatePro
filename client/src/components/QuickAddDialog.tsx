
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useCreateProject } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { Project, crewOperations, projectOperations } from "@/lib/firestore";
import { Plus, Check, Briefcase, Calendar, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { ClientComboSelector } from "./ClientComboSelector";
import { hasPermission } from "@/lib/permissions";
import { ProjectDialog } from "./ProjectDialog"; // Reuse for full project? Or reimplement simple version?
// Let's reimplement a unified simple form that handles types.

interface QuickAddDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultDate?: string;
    onSuccess?: () => void;
    initialLinkedProjectId?: string;
    hiddenTabs?: string[];
    defaultTab?: string;
}

export function QuickAddDialog({ open, onOpenChange, defaultDate, onSuccess, initialLinkedProjectId, hiddenTabs = [], defaultTab = "event" }: QuickAddDialogProps) {
    // Map legacy default tabs to 'event'
    const resolveTab = (t: string) => (t === 'task' || t === 'appointment') ? 'event' : t;
    const [tab, setTab] = useState(resolveTab(defaultTab));

    // Category State
    const [category, setCategory] = useState<string>(
        (defaultTab === 'appointment') ? 'appointment' : 'task'
    );

    const { t } = useTranslation();
    const { currentOrgId, org, claims, currentPermissions } = useAuth();
    const { toast } = useToast();

    // Permission Check
    const canManageSchedule = hasPermission(currentPermissions, 'manage_schedule') ||
        claims?.globalRole === 'platform_owner' ||
        claims?.globalRole === 'platform_admin';

    // Form State
    const [title, setTitle] = useState("");
    const [clientId, setClientId] = useState("");
    const [linkedProjectId, setLinkedProjectId] = useState(initialLinkedProjectId || "");

    // Date/Time State
    const [isAllDay, setIsAllDay] = useState(false);
    const [startDate, setStartDate] = useState(defaultDate || "");
    const [startTime, setStartTime] = useState("09:00");
    const [endDate, setEndDate] = useState(defaultDate || "");
    const [endTime, setEndTime] = useState("10:00");

    const [description, setDescription] = useState("");
    const [assigneeId, setAssigneeId] = useState(""); // Crew or User
    const [visibility, setVisibility] = useState<string[]>([]);

    // Mutations
    const createProject = useCreateProject();
    const { data: clients = [] } = useClients();

    const { data: crews = [] } = useQuery({
        queryKey: ['crews', currentOrgId],
        queryFn: () => crewOperations.getByOrg(currentOrgId!),
        enabled: !!currentOrgId
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects', currentOrgId],
        queryFn: () => projectOperations.getByOrg(currentOrgId!),
        enabled: !!currentOrgId
    });

    useEffect(() => {
        if (defaultDate) {
            setStartDate(defaultDate);
            setEndDate(defaultDate);
        }
    }, [defaultDate]);

    // Update End Date when Start Date changes (if End was same as Start)
    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStart = e.target.value;
        if (startDate === endDate) {
            setEndDate(newStart);
        }
        setStartDate(newStart);
    };

    const handleSubmit = async () => {
        if (!title || !startDate) {
            toast({ variant: "destructive", title: "Missing Fields", description: "Title and Start Date are required." });
            return;
        }

        try {
            // DATE CONSTRUCTION
            let start: Date;
            let end: Date;

            if (isAllDay) {
                // All Day: Start at 00:00, End at 23:59:59 of End Date
                start = new Date(`${startDate}T00:00:00`);
                end = new Date(`${endDate || startDate}T23:59:59`);
            } else {
                // Specific Time
                start = new Date(`${startDate}T${startTime}`);
                end = new Date(`${endDate || startDate}T${endTime}`);

                // Validation: End > Start
                if (end <= start) {
                    // Auto-correct or error? Let's just create 1 hour duration if invalid
                    end = new Date(start.getTime() + 60 * 60 * 1000);
                }
            }

            if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error("Invalid Date/Time");

            // Construct Payload
            const payload: any = {
                name: title,
                type: tab, // 'event' or 'project'
                eventCategory: tab === 'event' ? category : undefined, // Only for events
                status: tab === 'project' ? 'new' : 'booked',
                clientId: clientId || 'internal',
                location: 'TBD',
                startDate: Timestamp.fromDate(start),
                estimatedCompletion: Timestamp.fromDate(end),
                assignedCrewId: (!assigneeId || assigneeId === '_unassigned') ? null : assigneeId,
                visibilityRoles: visibility.length > 0 ? visibility : null,
                notes: description,
                // Linked Data
                linkedProjectId: linkedProjectId || null,
            };

            await createProject.mutateAsync(payload);

            toast({ title: "Success", description: `${tab === 'event' ? category : 'Project'} created.` });
            onOpenChange(false);
            onSuccess?.();

            // Reset
            setTitle("");
            setDescription("");
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
        }
    };

    // Helper to render Date Row
    // ...

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add to Schedule</DialogTitle>
                    <DialogDescription>Create a new task, appointment, or project.</DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={setTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        {/* Unified Event Tab */}
                        <TabsTrigger value="event" className="gap-2">
                            <Calendar className="h-4 w-4" /> Event
                        </TabsTrigger>

                        {/* Project Tab (Only if not hidden) */}
                        {!hiddenTabs.includes('project') && (
                            <TabsTrigger value="project" className="gap-2">
                                <Briefcase className="h-4 w-4" /> Project
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <div className="py-4 space-y-4">
                        {/* Category Selector (Only for Event tab) */}
                        {tab === 'event' && (
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* Standard Types */}
                                        <SelectItem value="task">Task</SelectItem>
                                        <SelectItem value="appointment">Appointment</SelectItem>
                                        {/* Restricted Types */}
                                        {canManageSchedule && (
                                            <>
                                                <SelectItem value="training">Training</SelectItem>
                                                <SelectItem value="meeting">Meeting</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {/* Title */}
                        <div className="space-y-2">
                            <Label>Title / Name</Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={tab === 'event' ? "e.g. Team Meeting" : "e.g. Smith Residence"} />
                        </div>

                        {/* Date & Time Controls */}
                        <div className="p-4 border rounded-lg bg-muted/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Timing</Label>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="all-day" className="cursor-pointer text-sm">All Day</Label>
                                    <Input
                                        id="all-day"
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={isAllDay}
                                        onChange={e => setIsAllDay(e.target.checked)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Start</Label>
                                    <div className="flex gap-2">
                                        <Input type="date" value={startDate} onChange={handleStartDateChange} className="flex-1" />
                                        {!isAllDay && (
                                            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-[110px]" />
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">End</Label>
                                    <div className="flex gap-2">
                                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1" />
                                        {!isAllDay && (
                                            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-[110px]" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Fields based on Tab */}

                        {/* Show Linked Project only for Appointments or specific categories if needed - NOW ALL EVENTS */}
                        {tab === 'event' && (
                            <div className="space-y-2">
                                <Label>Related Project (Optional)</Label>
                                <Select value={linkedProjectId} onValueChange={setLinkedProjectId}>
                                    <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">None</SelectItem>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {(category === 'appointment' || tab === 'project') && (
                            <div className="space-y-2">
                                <Label>Client (Optional)</Label>
                                <ClientComboSelector clients={clients as any} value={clientId} onChange={setClientId} />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Assignee (Crew)</Label>
                            <Select value={assigneeId} onValueChange={setAssigneeId}>
                                <SelectTrigger><SelectValue placeholder="Select Crew..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_unassigned">Unassigned</SelectItem>
                                    {crews.map(c => <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span></SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Visibility (Who can see this?)</Label>
                            <Select value={visibility[0] || "all"} onValueChange={(val) => setVisibility(val === "all" ? [] : [val])}>
                                <SelectTrigger><SelectValue placeholder="Everyone" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Everyone</SelectItem>
                                    <SelectItem value="admin">Admins Only</SelectItem>
                                    <SelectItem value="manager">Managers & Admins</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">Detailed role selection available in settings.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add details..." />
                        </div>

                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={!title}>Create {tab === 'event' ? 'Event' : 'Project'}</Button>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
