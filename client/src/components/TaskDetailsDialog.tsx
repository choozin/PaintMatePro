
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Project, crewOperations, projectOperations, deleteProject } from "@/lib/firestore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Trash2, Edit2, MapPin, Users, Calendar as CalendarIcon, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { QuickAddDialog } from "./QuickAddDialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/useProjects";
import { hasPermission } from "@/lib/permissions";
import { Input } from "@/components/ui/input"; // Just in case, though mostly selecting
import { Textarea } from "@/components/ui/textarea";

interface TaskDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: Project | null;
}

export function TaskDetailsDialog({ open, onOpenChange, task }: TaskDetailsDialogProps) {
    const { currentOrgId, claims, currentPermissions } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const { data: projects = [] } = useProjects();
    const updateProject = useMutation({
        mutationFn: (data: Partial<Project>) => projectOperations.update(task?.id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast({ title: "Updated", description: "Event updated successfully." });
            setIsEditing(false);
        }
    });

    // Edit State
    const [editCategory, setEditCategory] = useState<string>('');
    const [editLinkedProjectId, setEditLinkedProjectId] = useState<string>('_none');
    const [editNotes, setEditNotes] = useState('');

    // Initialize edit state when opening edit mode
    const startEditing = () => {
        setEditCategory(task?.eventCategory || task?.type === 'appointment' ? 'appointment' : 'task'); // Default fallback
        setEditLinkedProjectId(task?.linkedProjectId || '_none');
        setEditNotes(task?.notes || '');
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!task) return;
        updateProject.mutate({
            eventCategory: editCategory as any,
            // If category matches legacy type, sync it? Or just rely on eventCategory?
            // Let's ensure type is 'event' if we are setting an event category, unless strict legacy compat needed.
            // Ideally we migrate to type='event' on save if it wasn't already.
            type: 'event',
            linkedProjectId: editLinkedProjectId === '_none' ? null : editLinkedProjectId,
            notes: editNotes
        } as any);
    };

    // Permissions: 'manage_schedule' to edit/delete
    const canManage = hasPermission(currentPermissions, 'manage_schedule');

    const handleDelete = async () => {
        if (!task || !confirm("Are you sure you want to delete this task?")) return;
        try {
            await deleteProject(task.id);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast({ title: "Deleted", description: "Task deleted successfully." });
            onOpenChange(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
        }
    };

    // Helper to format date
    const formatDate = (dateString?: any) => {
        if (!dateString) return "TBD";
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        return format(date, "MMM d, yyyy h:mm a");
    };

    // Get Assignee Name
    const { data: crews = [] } = useQuery({
        queryKey: ['crews', currentOrgId],
        queryFn: () => currentOrgId ? crewOperations.getByOrg(currentOrgId) : Promise.resolve([]),
        enabled: !!currentOrgId
    });

    const assigneeName = crews.find(c => c.id === task?.assignedCrewId)?.name || "Unassigned";

    if (!task) return null;

    // Resolve Display Type
    const displayCategory = task.eventCategory || (task.type === 'appointment' ? 'appointment' : 'task');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 capitalize">
                        {displayCategory === 'appointment' ? <CalendarIcon className="h-5 w-5 text-blue-500" /> : <ClipboardListIcon className="h-5 w-5 text-green-500" />}
                        {task.name}
                    </DialogTitle>
                    <DialogDescription className="capitalize">
                        {displayCategory} Details
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {isEditing ? (
                        <div className="space-y-4">
                            {/* Category Selector */}
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={editCategory} onValueChange={setEditCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="task">Task</SelectItem>
                                        <SelectItem value="appointment">Appointment</SelectItem>
                                        {(canManage || claims?.globalRole === 'platform_owner') && (
                                            <>
                                                <SelectItem value="training">Training</SelectItem>
                                                <SelectItem value="meeting">Meeting</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Linked Project Selector */}
                            <div className="space-y-2">
                                <Label>Related Project</Label>
                                <Select value={editLinkedProjectId} onValueChange={setEditLinkedProjectId}>
                                    <SelectTrigger><SelectValue placeholder="Select Project..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">None</SelectItem>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                            </div>
                        </div>
                    ) : (
                        // View Mode
                        <>
                            <div className="flex items-start gap-3">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground mt-1" />
                                <div>
                                    <p className="font-medium text-sm">Start: {formatDate(task.startDate)}</p>
                                    <p className="text-sm text-muted-foreground">End: {formatDate(task.estimatedCompletion)}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{assigneeName}</span>
                            </div>

                            {/* Show Category if specific */}
                            {task.eventCategory && (
                                <div className="flex items-center gap-3">
                                    <ClipboardListIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm capitalize">{task.eventCategory}</span>
                                </div>
                            )}

                            {task.linkedProjectId && (
                                <div className="flex items-center gap-3">
                                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-blue-600 hover:underline cursor-pointer" onClick={() => window.location.href = `/projects/${task.linkedProjectId}`}>
                                        View Linked Project
                                    </span>
                                </div>
                            )}

                            {task.notes && (
                                <div className="bg-muted/50 p-3 rounded-md text-sm">
                                    {task.notes}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button onClick={handleSave}>Save Changes</Button>
                        </>
                    ) : (
                        canManage && (
                            <>
                                <Button variant="destructive" size="sm" onClick={handleDelete}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </Button>
                                <Button variant="outline" size="sm" onClick={startEditing}>
                                    <Edit2 className="h-4 w-4 mr-2" /> Edit
                                </Button>
                            </>
                        )
                    )}
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ClipboardListIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11h4" />
            <path d="M12 16h4" />
            <path d="M8 11h.01" />
            <path d="M8 16h.01" />
        </svg>
    )
}
