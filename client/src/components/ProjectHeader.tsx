import React from "react";
import { useLocation } from "wouter";
import { Project, ProjectStatus } from "@/lib/firestore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowLeft, Phone, Mail, MapPin,
    Calendar, PenSquare, User, Clock, ChevronRight, MessageSquare
} from "lucide-react";
import { ProjectTimelineSheet } from "@/components/ProjectTimelineSheet";
import { ProjectDialog } from "@/components/ProjectDialog";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ProjectHeaderProps {
    project: Project & { id: string };
    clientName?: string;
    clientPhone?: string;
    clientMobilePhone?: string;
    clientEmail?: string;
    className?: string;
}

import { getDerivedStatus } from "@/lib/project-status";

export function ProjectHeader({ project, clientName, clientPhone, clientMobilePhone, clientEmail, className }: ProjectHeaderProps) {
    const [, setLocation] = useLocation();
    const { t } = useTranslation();

    const displayStatus = getDerivedStatus(project.timeline, project.status, !!project.startDate);

    // Status Logic
    const statusColors: Record<string, string> = {
        lead: "bg-blue-100 text-blue-800 border-blue-200",
        quoted: "bg-purple-100 text-purple-800 border-purple-200",
        booked: "bg-indigo-100 text-indigo-800 border-indigo-200",
        "in-progress": "bg-blue-100 text-blue-600 border-blue-200",
        paused: "bg-orange-100 text-orange-800 border-orange-200",
        completed: "bg-green-100 text-green-600 border-green-200",
        invoiced: "bg-yellow-100 text-yellow-800 border-yellow-200",
        paid: "bg-green-300 text-green-900 border-green-400",
        "on-hold": "bg-gray-100 text-gray-800 border-gray-200",
        pending: "bg-gray-100 text-gray-800 border-gray-200",
    };

    const handleCall = () => {
        if (clientPhone) window.location.href = `tel:${clientPhone}`;
    };

    const handleText = () => {
        if (clientMobilePhone) window.location.href = `sms:${clientMobilePhone}`;
    };

    const handleMap = () => {
        if (project.location) {
            const query = encodeURIComponent(project.location);
            window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
        }
    };

    const handleEmail = () => {
        if (clientEmail) window.location.href = `mailto:${clientEmail}`;
    };

    // Date Logic
    // Date Logic
    const now = new Date();

    // Helper to safely get Date object
    const getDate = (d: any) => {
        if (!d) return null;
        if (typeof d.toDate === 'function') return d.toDate();
        return new Date(d);
    };

    // Sort timeline by date
    const sortedTimeline = [...(project.timeline || [])].sort((a: any, b: any) => {
        const dateA = getDate(a.date)?.getTime() || 0;
        const dateB = getDate(b.date)?.getTime() || 0;
        return dateA - dateB;
    });

    const pastEvents = sortedTimeline.filter(e => {
        const d = getDate(e.date);
        return d && d.getTime() <= now.getTime();
    });

    const futureEvents = sortedTimeline.filter(e => {
        const d = getDate(e.date);
        return d && d.getTime() > now.getTime();
    });

    const latestEvent = pastEvents.length > 0
        ? pastEvents[pastEvents.length - 1]
        : { label: 'Project Created', date: project.createdAt };

    // Determine Next Step
    let nextStepObj = null;

    if (futureEvents.length > 0) {
        nextStepObj = {
            label: futureEvents[0].label,
            date: futureEvents[0].date
        };
    } else {
        // Fallback to existing logic if no specific future events are logged
        const startDate = getDate(project.startDate);
        const completionDate = getDate(project.estimatedCompletion);

        // If status suggests we haven't started, and startDate is future
        if ((project.status === 'lead' || project.status === 'quoted' || project.status === 'booked') && startDate && startDate > now) {
            nextStepObj = { label: "Scheduled Start", date: project.startDate };
        } else if (completionDate && completionDate > now) {
            nextStepObj = { label: "Due Date", date: project.estimatedCompletion };
        }
    }

    const nextStepLabel = nextStepObj?.label;
    const nextStepDate = nextStepObj?.date;

    const formatPhoneNumber = (phoneNumber: string) => {
        const cleaned = ('' + phoneNumber).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return '(' + match[1] + ') ' + match[2] + '-' + match[3];
        }
        return phoneNumber;
    };

    return (
        <div className={cn("flex flex-col gap-6 w-full", className)}>
            {/* 1. Top Bar: Back & Status */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="-ml-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5 mr-1" />
                    Back
                </Button>
                <div className="flex gap-2">
                    <ProjectDialog
                        project={project}
                        mode="edit"
                        trigger={
                            <Button variant="outline" size="sm">
                                <PenSquare className="h-4 w-4 mr-2" />
                                Edit Project
                            </Button>
                        }
                    />
                    <Badge className={cn("text-sm px-3 py-1", statusColors[displayStatus] || "bg-gray-100")}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Location & Contact */}
                <div className="space-y-6">
                    {/* Location */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Location</p>
                        {project.location ? (
                            <Button
                                variant="outline"
                                className="w-full justify-start h-auto py-3 px-4 border-l-4 border-l-red-500 hover:bg-red-50"
                                onClick={handleMap}
                            >
                                <MapPin className="h-5 w-5 mr-3 text-red-600 shrink-0" />
                                <span className="truncate text-left">{project.location}</span>
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
                    <div>
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
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium text-foreground">{formatPhoneNumber(clientMobilePhone)}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">Text</span>
                                    </div>
                                </Button>
                            )}

                            {/* Email */}
                            {clientEmail ? (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-auto py-3 px-4 border-l-4 border-l-indigo-500 hover:bg-indigo-50 group"
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

                {/* Schedule / Timeline */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project Schedule</p>
                        </div>

                        {/* Current Step Card */}
                        <div className="relative border-l-2 border-indigo-200 pl-4 py-2 space-y-4 bg-muted/20 rounded-r-lg p-4">
                            {/* Current Step */}
                            <div>
                                <p className="text-xs text-muted-foreground">Current Step</p>
                                <p className="font-medium text-sm">{latestEvent.label}</p>
                                <p className="text-xs text-muted-foreground">
                                    {latestEvent.date?.toDate ? format(latestEvent.date.toDate(), "MMM d, yyyy") : "Unknown Date"}
                                </p>
                            </div>
                            <div className="absolute left-[-5px] top-[20px] w-2 h-2 rounded-full bg-indigo-500" />

                            {/* Next Step */}
                            {nextStepDate && (
                                <div className="opacity-75">
                                    <p className="text-xs text-muted-foreground">Next Step</p>
                                    <p className="font-medium text-sm">{nextStepLabel}</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">
                                            {nextStepDate?.toDate ? format(nextStepDate.toDate(), "MMM d, yyyy") : "TBD"}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* View Timeline Button - Full Width Below */}
                        <ProjectTimelineSheet
                            project={project}
                            trigger={
                                <Button variant="outline" className="w-auto self-start border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    View Full Timeline
                                </Button>
                            }
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
