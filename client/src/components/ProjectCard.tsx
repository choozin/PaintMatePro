import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, User } from "lucide-react";

interface ProjectCardProps {
  id: string;
  name: string;
  clientName: string;
  status: "pending" | "in-progress" | "completed" | "on-hold";
  location: string;
  startDate: string;
  estimatedCompletion?: string;
  onClick?: () => void;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "on-hold": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export function ProjectCard({
  id,
  name,
  clientName,
  status,
  location,
  startDate,
  estimatedCompletion,
  onClick,
}: ProjectCardProps) {
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
        <Badge className={`${statusColors[status]} shrink-0`} data-testid={`badge-status-${id}`}>
          {status.replace("-", " ")}
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
              View Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
