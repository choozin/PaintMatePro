import { Project, ProjectEvent } from "@/lib/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, Clock, FileText, PlayCircle, Plus, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ActivityFeedProps {
    projects: (Project & { id: string })[];
}

export function ActivityFeed({ projects }: ActivityFeedProps) {
    // Flatten events from all projects
    const allEvents = projects
        .flatMap(project =>
            (project.timeline || []).map(event => ({
                ...event,
                projectName: project.name,
                projectId: project.id,
                clientName: "Client", // Ideally we'd map this if we had the client list handy, but for speed we'll use generic or fetch
            }))
        )
        .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
        .slice(0, 10); // Top 10 recent events

    const getIcon = (type: ProjectEvent['type']) => {
        switch (type) {
            case 'lead_created': return <Plus className="h-4 w-4 text-blue-500" />;
            case 'quote_provided': return <FileText className="h-4 w-4 text-amber-500" />;
            case 'quote_accepted': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'started': return <PlayCircle className="h-4 w-4 text-emerald-600" />;
            case 'payment_received': return <DollarSign className="h-4 w-4 text-green-600" />;
            default: return <Clock className="h-4 w-4 text-gray-500" />;
        }
    };

    if (allEvents.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground text-sm">
                No recent activity recorded.
            </div>
        )
    }

    return (
        <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-6 pl-1">
                {allEvents.map((event, index) => (
                    <div key={`${event.id}-${index}`} className="flex gap-4 relative group">
                        {/* Timeline Line */}
                        {index !== allEvents.length - 1 && (
                            <div className="absolute left-[19px] top-8 bottom-[-24px] w-[2px] bg-border group-hover:bg-muted-foreground/30 transition-colors" />
                        )}

                        <div className="relative z-10 bg-background rounded-full p-2 border shadow-sm ring-4 ring-background">
                            {getIcon(event.type)}
                        </div>

                        <div className="flex-1 pt-1.5 space-y-1">
                            <div className="flex justify-between items-start text-sm">
                                <span className="font-medium">{event.label}</span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(event.date.toDate(), { addSuffix: true })}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/80">{event.projectName}</span>
                                {event.createdBy && <span> • by {event.createdBy}</span>}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
