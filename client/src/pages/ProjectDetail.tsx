import { useParams, useLocation, Link } from "wouter";
import { useProject } from "@/hooks/useProjects";
import { useClient } from "@/hooks/useClients";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomMeasurement } from "@/components/RoomMeasurement";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { ArrowLeft, Calendar, MapPin, User } from "lucide-react";
import { ProjectDialog } from "@/components/ProjectDialog";

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id || null;
  const [, setLocation] = useLocation();

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: client } = useClient(project?.clientId || null);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Project not found</p>
        <Button onClick={() => setLocation("/projects")} data-testid="button-back-to-projects">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  const statusColors = {
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    "in-progress": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    "on-hold": "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/projects")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-4xl font-bold" data-testid="text-project-name">
              {project.name}
            </h1>
            <Badge className={statusColors[project.status]} data-testid="badge-status">
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Manage project details, room measurements, and quotes
          </p>
        </div>
        <ProjectDialog project={project} mode="edit" />
      </div>

      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium" data-testid="text-client-name">
                  {client?.name || "Loading..."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium" data-testid="text-location">
                  {project.location}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium" data-testid="text-start-date">
                  {new Date(project.startDate.seconds * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Rooms and Quotes */}
      <Tabs defaultValue="rooms" className="w-full">
        <TabsList data-testid="tabs-project-detail">
          <TabsTrigger value="rooms" data-testid="tab-rooms">
            Room Measurements
          </TabsTrigger>
          <TabsTrigger value="quotes" data-testid="tab-quotes">
            Quotes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rooms" className="mt-6">
          <RoomMeasurement projectId={projectId!} />
        </TabsContent>
        <TabsContent value="quotes" className="mt-6">
          <QuoteBuilder projectId={projectId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
