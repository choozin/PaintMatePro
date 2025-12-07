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

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  quoted: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  booked: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  paused: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  resumed: "bg-blue-200 text-blue-900 dark:bg-blue-800/40 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  invoiced: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-green-300 text-green-900 dark:bg-green-800/40 dark:text-green-300",
  "on-hold": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
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
}: ProjectCardProps) {
  const { t } = useTranslation();
  const displayStatus = getDerivedStatus(timeline, status, !!startDate);

  return (
    <Card className="hover-elevate" data-testid={`card-project-${id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-xl font-semibold truncate">{name}</CardTitle>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="truncate">{clientName}</span>
          </div>
        </div>
        <Badge className={`${statusColors[displayStatus] || statusColors.pending} shrink-0`} data-testid={`badge-status-${id}`}>
          {t(`projects.status.${displayStatus}`, { defaultValue: displayStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">{location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              {startDate}
              {estimatedCompletion && ` - ${estimatedCompletion}`}
            </span>
          </div>
          {onClick && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={onClick}
              data-testid={`button-view-project-${id}`}
            >
              {t('projects.view_details')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
