import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, User } from "lucide-react";

import { ProjectStatus, ProjectEvent } from "@/lib/firestore";
import { getDerivedStatus } from "@/lib/project-status";

interface ProjectCardProps {
  id: string;
  name: string;
  clientName: string;
  status: ProjectStatus;
  timeline?: ProjectEvent[];
  location: string;
  startDate: string;
  estimatedCompletion?: string;
  onClick?: () => void;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  new: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "New" },
  lead: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "New" }, // Legacy map
  quote_created: { color: "bg-purple-100 text-purple-700 border-purple-200", label: "Quote Created" },
  quoted: { color: "bg-purple-100 text-purple-700 border-purple-200", label: "Quote Created" }, // Legacy map
  quote_sent: { color: "bg-indigo-100 text-indigo-700 border-indigo-200", label: "Quote Sent" },
  booked: { color: "bg-sky-100 text-sky-700 border-sky-200", label: "Booked" },
  "in-progress": { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "In Progress" },
  paused: { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Paused" },
  resumed: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "In Progress" },
  completed: { color: "bg-teal-100 text-teal-700 border-teal-200", label: "Completed" },
  invoiced: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Invoiced" },
  paid: { color: "bg-green-100 text-green-800 border-green-200", label: "Paid" },
  "on-hold": { color: "bg-rose-100 text-rose-700 border-rose-200", label: "On Hold" },
  pending: { color: "bg-gray-100 text-gray-700 border-gray-200", label: "Accepted" },
};

import { useTranslation } from "react-i18next";

export function ProjectCard({
  id,
  name,
  clientName,
  status,
  timeline,
  location,
  startDate,
  estimatedCompletion,
  onClick,
  crewName,
}: ProjectCardProps & { crewName?: string }) {
  const { t } = useTranslation();
  const displayStatus = getDerivedStatus(timeline, status, startDate, estimatedCompletion);

  const statusStyle = statusConfig[displayStatus] || statusConfig.pending;

  // Derive an accent color border based on status for the left edge
  // Derive an accent color border based on status for the left edge
  const accentBorderColor =
    displayStatus === 'completed' || displayStatus === 'paid' ? 'border-l-teal-500' :
      displayStatus === 'booked' ? 'border-l-sky-500' :
        displayStatus === 'in-progress' ? 'border-l-emerald-500' :
          displayStatus === 'quoted' ? 'border-l-purple-500' :
            displayStatus === 'lead' ? 'border-l-slate-400' :
              'border-l-transparent';

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-300 border border-border/50 hover:border-primary/20 hover:shadow-lg hover:-translate-y-1 ${accentBorderColor} border-l-4 ${onClick ? 'cursor-pointer' : ''}`}
      data-testid={`card-project-${id}`}
      onClick={onClick}
    >
      <CardContent className="p-5 space-y-4">

        {/* Header Section */}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-bold text-lg leading-tight tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
              {name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
              <User className="h-3.5 w-3.5" />
              <span className="truncate font-medium">{clientName}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`${statusStyle.color} px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider shrink-0 border`}
          >
            {t(`projects.status.${displayStatus}`, { defaultValue: statusStyle.label })}
          </Badge>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-border/40" />

        {/* Details Grid */}
        {/* Details Vertical Stack */}
        <div className="flex flex-col gap-2.5 text-sm">
          {/* Location */}
          <div className="flex items-start gap-3 text-muted-foreground">
            <div className="p-1.5 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors mt-0.5 shrink-0">
              <MapPin className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
            </div>
            <span className="leading-tight py-0.5">{location || "No Location"}</span>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3 text-muted-foreground">
            <div className="p-1.5 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors mt-0.5 shrink-0">
              <Calendar className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
            </div>
            <span className="leading-tight py-0.5">
              {startDate}
              {estimatedCompletion ? ` - ${estimatedCompletion}` : ''}
            </span>
          </div>

          {/* Crew (Conditional) */}
          {crewName && (
            <div className="flex items-center gap-3 text-foreground/90 mt-1">
              <div className="p-1.5 rounded-full bg-indigo-50 text-indigo-600 shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assigned Crew</span>
                <span className="font-medium text-sm leading-none">{crewName}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Hover Reveal Action */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </Card>
  );
}
