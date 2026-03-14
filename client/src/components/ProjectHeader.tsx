import React from "react";
import { useLocation } from "wouter";
import { Project, ProjectStatus, Client, quoteOperations, Timestamp } from "@/lib/firestore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowLeft, Phone, Mail, MapPin,
    Calendar, PenSquare, User, Clock, ChevronRight, MessageSquare, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { ProjectTimelineSheet } from "@/components/ProjectTimelineSheet";
import { ProjectDialog } from "@/components/ProjectDialog";
import { useTranslation } from "react-i18next";
import { cn, getContrastColor } from "@/lib/utils";
import { format } from "date-fns";
import { CrewManagementDialog } from "@/components/CrewManagementDialog";
import { getProjectTimelineEvents } from "@/lib/timelineUtils";
import { getDerivedStatus } from "@/lib/project-status";
import { useQuery } from "@tanstack/react-query";
import { crewOperations, projectOperations } from "@/lib/firestore";
import { useUpdateProject } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";

interface ProjectHeaderProps {
    project: Project & { id: string };
    client?: Client | null;
    clientName?: string;
    clientPhone?: string;
    clientMobilePhone?: string;
    clientEmail?: string;
    className?: string;
    extraActions?: React.ReactNode;
}

export function ProjectHeader({ project, client, clientName, clientPhone, clientMobilePhone, clientEmail, className, extraActions }: ProjectHeaderProps) {
    const [, setLocation] = useLocation();
    const { t } = useTranslation();
    const updateProject = useUpdateProject();
    const { toast } = useToast();

    const displayStatus = getDerivedStatus(project.timeline, project.status, project.startDate, project.estimatedCompletion);

    // Fetch Assigned Crew
    const { data: assignedCrew } = useQuery({
        queryKey: ['crew', project.assignedCrewId],
        queryFn: () => crewOperations.get(project.assignedCrewId!),
        enabled: !!project.assignedCrewId
    });

    // Fetch Quotes for Timeline
    const { data: quotes = [] } = useQuery({
        queryKey: ['quotes', 'project', project.id],
        queryFn: () => quoteOperations.getByProject(project.id),
        enabled: !!project.id
    });

    // Unified Timeline Events
    const timelineEvents = getProjectTimelineEvents(project, client, quotes);

    // Status Logic
    const statusColors: Record<string, string> = {
        lead: "bg-amber-100 text-amber-700 border-amber-200",
        quoted: "bg-purple-100 text-purple-700 border-purple-200",
        booked: "bg-sky-100 text-sky-700 border-sky-200",
        "in-progress": "bg-emerald-100 text-emerald-700 border-emerald-200",
        paused: "bg-orange-100 text-orange-700 border-orange-200",
        resumed: "bg-blue-100 text-blue-700 border-blue-200",
        completed: "bg-teal-100 text-teal-700 border-teal-200",
        invoiced: "bg-yellow-100 text-yellow-800 border-yellow-200",
        paid: "bg-green-100 text-green-800 border-green-200",
        "on-hold": "bg-rose-100 text-rose-700 border-rose-200",
        pending: "bg-violet-100 text-violet-700 border-violet-200",
        overdue: "bg-red-100 text-red-700 border-red-500 animate-pulse font-bold text-md px-4 border-2", // Custom prominent style
    };

    const handleCall = () => {
        if (clientPhone) window.location.href = `tel:${clientPhone}`;
    };

    const handleText = () => {
        if (clientMobilePhone) window.location.href = `sms:${clientMobilePhone}`;
    };

    const handleMap = () => {
        if (project.address) {
            const query = encodeURIComponent(project.address);
            window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
        }
    };

    const handleEmail = () => {
        if (clientEmail) window.location.href = `mailto:${clientEmail}`;
    };

    const formatPhoneNumber = (phoneNumber: string) => {
        const cleaned = ('' + phoneNumber).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return '(' + match[1] + ') ' + match[2] + '-' + match[3];
        }
        return phoneNumber;
    };


    // Determine Current/Next Steps from Unified Timeline
    const completedEvents = timelineEvents.filter(e => e.status === 'completed');
    const currentStep = completedEvents.length > 0 ? completedEvents[completedEvents.length - 1] : timelineEvents[0];

    const futureEvents = timelineEvents.filter(e => e.status === 'pending' || e.status === 'future');
    const nextStep = futureEvents.length > 0 ? futureEvents[0] : null;

    const handleToggleComplete = async () => {
        const isCompleted = ['completed', 'invoiced', 'paid'].includes(project.status);
        try {
            if (isCompleted) {
                // Revert to the last valid status prior to completion
                // Filter out completed/invoiced/paid from events to find what it was right before
                const previousEvents = timelineEvents.filter(e => e.status === 'completed' && e.type && !['finished', 'invoice_issued', 'payment_received'].includes(e.type as string));
                const lastEvent = previousEvents.length > 0 ? previousEvents[previousEvents.length - 1] : null;

                // Determine previous status. Default to in-progress if unknown.
                let prevStatus = 'in-progress';
                if (lastEvent) {
                    if (lastEvent.type === 'paused') prevStatus = 'paused';
                    else if (lastEvent.type === 'quote_accepted' || lastEvent.type === 'scheduled') prevStatus = 'booked';
                    else if (lastEvent.type === 'started' || lastEvent.type === 'resumed') prevStatus = 'in-progress';
                }

                await updateProject.mutateAsync({
                    id: project.id,
                    data: {
                        status: prevStatus as any,
                        completedAt: null as any
                    }
                });
                toast({
                    title: "Project Reopened",
                    description: "Status changed back to in-progress.",
                });
            } else {
                // Mark complete
                await updateProject.mutateAsync({
                    id: project.id,
                    data: {
                        status: 'completed',
                        completedAt: Timestamp.now()
                    }
                });
                toast({
                    title: "Project Completed",
                    description: "Great job! Project marked as completed.",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update project status.",
            });
        }
    };

    return (
        <div className={cn("flex flex-col gap-6 w-full", className)}>
            {/* 1. Top Bar: Back & Status */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="-ml-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    Back
                </Button>
                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 w-full sm:w-auto">
                    {extraActions}
                    {/* Complete Project Toggle */}
                    <Button
                        size="sm"
                        variant={['completed', 'invoiced', 'paid'].includes(project.status) ? "default" : "outline"}
                        className={cn(
                            ['completed', 'invoiced', 'paid'].includes(project.status) ? "bg-teal-600 hover:bg-teal-700" : "border-teal-600/50 text-teal-700 hover:bg-teal-50"
                        )}
                        onClick={handleToggleComplete}
                    >
                        {['completed', 'invoiced', 'paid'].includes(project.status) ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <div className="h-4 w-4 mr-2 border-2 border-current rounded-full" />}
                        {['completed', 'invoiced', 'paid'].includes(project.status) ? "Completed" : "Mark Complete"}
                    </Button>

                    <ProjectDialog
                        project={project}
                        mode="edit"
                        onSuccess={() => setLocation("/projects")}
                        trigger={
                            <Button variant="outline" size="sm">
                                <PenSquare className="h-4 w-4 mr-2" />
                                Edit Project
                            </Button>
                        }
                    />
                    {['booked', 'in-progress'].includes(project.status) && !project.assignedCrewId && (
                        <ProjectDialog
                            project={project}
                            mode="edit"
                            onSuccess={() => setLocation("/projects")}
                            trigger={
                                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse font-semibold">
                                    Assign Crew
                                </Button>
                            }
                        />
                    )}
                    {assignedCrew && (
                        <CrewManagementDialog
                            project={project}
                            currentCrew={assignedCrew}
                            trigger={
                                <div
                                    className="flex items-center gap-2 px-3 py-1 bg-background rounded-md border text-sm cursor-pointer hover:opacity-80 transition-opacity"
                                    style={assignedCrew.color ? { backgroundColor: assignedCrew.color, borderColor: assignedCrew.color } : undefined}
                                >
                                    <User className={cn("h-4 w-4", assignedCrew.color ? (getContrastColor(assignedCrew.color) === 'white' ? "text-white" : "text-black") : "text-muted-foreground")} />
                                    <span className={cn("font-medium", assignedCrew.color ? (getContrastColor(assignedCrew.color) === 'white' ? "text-white" : "text-black") : "text-foreground")}>{assignedCrew.name}</span>
                                </div>
                            }
                        />
                    )}
                    <Badge className={cn("text-sm transition-all", statusColors[displayStatus] || "bg-gray-100", displayStatus === 'overdue' && "shadow-lg scale-105")}>
                        {displayStatus === 'overdue' && <AlertCircle className="w-4 h-4 mr-2" />}
                        {t(`projects.status.${displayStatus.replace("-", "_")}`, { defaultValue: displayStatus.replace(/-/g, ' ').toUpperCase() })}
                    </Badge>
                </div>
            </div>

            {/* 2. Identity Block */}
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                <p className="text-muted-foreground text-lg">{clientName || "Unknown Client"}</p>
            </div>

            {/* 3. Info Grid (Transparent Card feel) */}
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Column 1: Location & Contact */}
                    <div className="space-y-6 min-w-0">
                        {/* Location */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Location</p>
                            {project.address ? (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-auto py-3 px-4 border-l-4 border-l-red-500 hover:bg-red-50"
                                    onClick={handleMap}
                                >
                                    <MapPin className="h-5 w-5 mr-3 text-red-600 shrink-0" />
                                    <span className="truncate text-left whitespace-normal h-auto leading-tight">{project.address}</span>
                                </Button>
                            ) : (
                                <ProjectDialog
                                    project={project}
                                    mode="edit"
                                    trigger={
                                        <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 text-muted-foreground hover:text-foreground border-muted-foreground/30 border-dashed">
                                            <MapPin className="h-5 w-5 mr-3 shrink-0 opacity-50" />
                                            Add Location
                                        </Button>
                                    }
                                />
                            )}
                        </div>

                        {/* Contact */}
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact</p>
                            <div className="space-y-2">
                                {/* Phone (Call) */}
                                {clientPhone ? (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start h-auto py-3 px-4 border-l-4 border-l-blue-500 hover:bg-blue-50 group"
                                        onClick={handleCall}
                                    >
                                        <Phone className="h-5 w-5 mr-3 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                                        <span className="font-medium text-foreground">{formatPhoneNumber(clientPhone)}</span>
                                    </Button>
                                ) : (
                                    <ProjectDialog
                                        project={project} mode="edit"
                                        trigger={
                                            <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 text-muted-foreground hover:text-foreground border-muted-foreground/30 border-dashed">
                                                <Phone className="h-5 w-5 mr-3 shrink-0 opacity-50" />
                                                Add Phone
                                            </Button>
                                        }
                                    />
                                )}

                                {/* Mobile (Text) - Optional */}
                                {clientMobilePhone && (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start h-auto py-3 px-4 border-l-4 border-l-green-500 hover:bg-green-50 group"
                                        onClick={handleText}
                                    >
                                        <MessageSquare className="h-5 w-5 mr-3 text-green-600 shrink-0 group-hover:scale-110 transition-transform" />
                                        <div className="flex flex-col items-start leading-tight">
                                            <span className="font-medium text-foreground">{formatPhoneNumber(clientMobilePhone)}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Text</span>
                                        </div>
                                    </Button>
                                )}

                                {/* Email */}
                                {clientEmail ? (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start h-auto py-3 px-4 border-l-4 border-l-indigo-500 hover:bg-indigo-50 group overflow-hidden"
                                        onClick={handleEmail}
                                    >
                                        <Mail className="h-5 w-5 mr-3 text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                                        <span className="truncate font-medium">{clientEmail}</span>
                                    </Button>
                                ) : (
                                    <ProjectDialog
                                        project={project} mode="edit"
                                        trigger={
                                            <Button variant="outline" className="w-full justify-start h-auto py-3 px-4 text-muted-foreground hover:text-foreground border-muted-foreground/30 border-dashed">
                                                <Mail className="h-5 w-5 mr-3 shrink-0 opacity-50" />
                                                Add Email
                                            </Button>
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Schedule / Timeline */}
                    <div className="space-y-4 min-w-0">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Schedule</p>
                            </div>

                            {/* Current Step Card */}
                            <div className="relative border-l-2 border-indigo-200 pl-4 py-2 space-y-3 bg-muted/20 rounded-r-lg p-4 h-full">
                                {/* Current Step */}
                                {currentStep && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Current Step</p>
                                        <p className="font-medium text-sm">{currentStep.label}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {currentStep.date ? format(currentStep.date instanceof Date ? currentStep.date : (currentStep.date as any).toDate ? (currentStep.date as any).toDate() : new Date(currentStep.date), "MMM d, yyyy") : "Completed"}
                                        </p>
                                    </div>
                                )}
                                <div className="absolute left-[-5px] top-[20px] w-2 h-2 rounded-full bg-indigo-500" />

                                {/* Next Step */}
                                {nextStep && (
                                    <div className="opacity-75">
                                        <p className="text-xs text-muted-foreground">Next Step</p>
                                        <p className="font-medium text-sm">{nextStep.label}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-muted-foreground">
                                                {nextStep.date ? format(nextStep.date instanceof Date ? nextStep.date : (nextStep.date as any).toDate ? (nextStep.date as any).toDate() : new Date(nextStep.date), "MMM d, yyyy") : "Pending"}
                                            </p>
                                            {nextStep.action && (
                                                <Button variant="ghost" className="h-auto p-0 text-xs text-primary underline-offset-4 hover:underline" onClick={nextStep.action.onClick} disabled={nextStep.action.disabled}>
                                                    {nextStep.action.label}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* View Timeline Button - Full Width Below */}
                            <ProjectTimelineSheet
                                project={project}
                                trigger={
                                    <Button variant="outline" className="w-full self-start border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300">
                                        <Calendar className="h-4 w-4 mr-2" />
                                        View/Modify Project Timeline
                                    </Button>
                                }
                            />
                        </div>
                    </div>

                    {/* Column 3: Project Notes Section */}
                    <div className="flex flex-col gap-4 min-w-0">
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="project-notes-header" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Client-Visible Notes</Label>
                            </div>
                            <div className="relative">
                                <textarea
                                    id="project-notes-header"
                                    defaultValue={project?.notes || ""}
                                    onBlur={(e) => {
                                        if (project && e.target.value !== (project.notes || "")) updateProject.mutate({ id: project.id, data: { notes: e.target.value } });
                                    }}
                                    className="flex min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                    placeholder="General project notes, scope overviews, or instructions for the team..."
                                />
                                {updateProject.isPending && <Loader2 className="h-4 w-4 absolute bottom-4 right-4 animate-spin text-muted-foreground" />}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="internal-notes-header" className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Invisible Notes</Label>
                            </div>
                            <div className="relative">
                                <textarea
                                    id="internal-notes-header"
                                    defaultValue={project?.internalNotes || ""}
                                    onBlur={(e) => {
                                        if (project && e.target.value !== (project.internalNotes || "")) updateProject.mutate({ id: project.id, data: { internalNotes: e.target.value } });
                                    }}
                                    className="flex min-h-[90px] w-full rounded-md border border-amber-200 bg-amber-50/50 px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                    placeholder="Internal team notes, issues, pricing concerns, or vendor details..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
