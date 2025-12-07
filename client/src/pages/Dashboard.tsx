
import { StatCard } from "@/components/StatCard";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectDialog } from "@/components/ProjectDialog";
import { ClientDialog } from "@/components/ClientDialog";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DollarSign, FolderKanban, Users, CheckCircle, Plus, FileText, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useClient } from "@/hooks/useClients"; // Keep for DashboardProjectCard
import { formatDate } from "@/lib/utils/dateFormat";
import type { Project } from "@/lib/firestore";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { AlertCircle, AlertTriangle } from "lucide-react";

// Helper for Project Card
function DashboardProjectCard({ project }: { project: Project & { id: string } }) {
  const { data: client } = useClient(project.clientId);
  const [, setLocation] = useLocation();

  return (
    <ProjectCard
      id={project.id}
      name={project.name}
      clientName={client?.name || 'Loading...'}
      status={project.status}
      timeline={project.timeline}
      location={project.location}
      startDate={formatDate(project.startDate)}
      estimatedCompletion={project.estimatedCompletion ? formatDate(project.estimatedCompletion) : undefined}
      onClick={() => setLocation(`/projects/${project.id}`)}
    />
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { t } = useTranslation();

  // Metrics Logic
  const activeProjects = projects.filter(p => ['in-progress', 'booked'].includes(p.status));
  const completedProjects = projects.filter(p => ['completed', 'paid', 'invoiced'].includes(p.status));
  const pendingProjects = projects.filter(p => ['lead', 'quoted'].includes(p.status)); // Pipeline

  // Actionable Items Logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysFromNow = new Date(today.getTime() + (3 * 86400000));

  const needsActionProjects = projects.filter(p => {
    if (!['lead', 'quoted'].includes(p.status)) return false;
    if (!p.startDate) return false;

    const start = p.startDate.toDate ? p.startDate.toDate() : new Date(p.startDate.seconds * 1000);
    // Check if start date is in the past (before today)
    // Actually user said "passed", so strictly less than today? Or <= ?
    // "Quoted but start date has passed" implies we missed it.
    return start < today;
  });

  const unassignedCrewProjects = projects.filter(p => {
    if (p.status !== 'booked') return false;
    if (p.assignedCrewId && p.assignedCrewId !== '_unassigned') return false;
    if (!p.startDate) return false;

    const start = p.startDate.toDate ? p.startDate.toDate() : new Date(p.startDate.seconds * 1000);
    return start >= today && start <= threeDaysFromNow;
  });

  // Calculate Revenue (Approximation based on completed projects)
  // Logic: Sum laborConfig.totalCost for now, or assume avg $5k if missing
  const totalRevenue = completedProjects.reduce((acc, p) => acc + (p.laborConfig?.totalCost || 5000), 0);

  // Pipeline Value (Potential revenue from unbooked jobs)
  const pipelineValue = pendingProjects.reduce((acc, p) => acc + (p.laborConfig?.totalCost || 3000), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {t('dashboard.welcome', { name: user?.displayName?.split(' ')[0] || 'Painter' })}
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Here's what's happening with your business today.
          </p>
        </div>
        <div className="flex gap-3">
          <ClientDialog mode="create" trigger={
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          } />
          <Button variant="outline" onClick={() => setLocation('/schedule')}>
            <CalendarIcon className="mr-2 h-4 w-4" /> Open Schedule
          </Button>
          <ProjectDialog mode="create" trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          } />
        </div>
      </div>

      {/* 1.5 Alerts / Actionable Items */}
      {(needsActionProjects.length > 0 || unassignedCrewProjects.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {needsActionProjects.length > 0 && (
            <Card className="border-l-4 border-l-red-500 bg-red-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Needs Action ({needsActionProjects.length})
                </CardTitle>
                <CardDescription className="text-red-600/80">
                  Quoted projects with passed start dates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {needsActionProjects.slice(0, 3).map(p => (
                    <li key={p.id} className="text-sm font-medium flex justify-between cursor-pointer hover:underline" onClick={() => setLocation(`/projects/${p.id}`)}>
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{formatDate(p.startDate)}</span>
                    </li>
                  ))}
                  {needsActionProjects.length > 3 && <li className="text-xs text-muted-foreground pt-1">+{needsActionProjects.length - 3} more</li>}
                </ul>
              </CardContent>
            </Card>
          )}

          {unassignedCrewProjects.length > 0 && (
            <Card className="border-l-4 border-l-amber-500 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Crew Assignment Needed ({unassignedCrewProjects.length})
                </CardTitle>
                <CardDescription className="text-amber-600/80">
                  Booked jobs starting soon without crew.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {unassignedCrewProjects.slice(0, 3).map(p => (
                    <li key={p.id} className="text-sm font-medium flex justify-between cursor-pointer hover:underline" onClick={() => setLocation(`/projects/${p.id}`)}>
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{formatDate(p.startDate)}</span>
                    </li>
                  ))}
                  {unassignedCrewProjects.length > 3 && <li className="text-xs text-muted-foreground pt-1">+{unassignedCrewProjects.length - 3} more</li>}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 2. Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: "YTD Estimate", isPositive: true }}
          className="bg-card shadow-sm border-l-4 border-l-green-500"
        />
        <StatCard
          title="Pipeline Value"
          value={`$${pipelineValue.toLocaleString()}`}
          icon={FileText}
          trend={{ value: `${pendingProjects.length} Potential Jobs`, isPositive: true }} // Neutral trend
          className="bg-card shadow-sm border-l-4 border-l-blue-500"
        />
        <StatCard
          title="Active Jobs"
          value={activeProjects.length}
          icon={FolderKanban}
          trend={{ value: "Currently Running", isPositive: true }}
          className="bg-card shadow-sm border-l-4 border-l-amber-500"
        />
        <StatCard
          title="Total Clients"
          value={clients.length}
          icon={Users}
          trend={{ value: "Lifetime", isPositive: true }}
          className="bg-card shadow-sm border-l-4 border-l-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* 3. Main Content (Active & Recent) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Active Projects List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold tracking-tight">Active Projects</h2>
              <Button variant="ghost" size="sm" onClick={() => setLocation('/projects')}>View All <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </div>

            {projectsLoading ? (
              <div className=" py-12 text-center text-muted-foreground">Loading projects...</div>
            ) : activeProjects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                  <FolderKanban className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
                  <h3 className="font-semibold text-lg">No Active Projects</h3>
                  <p className="text-muted-foreground max-w-sm mt-1">You don't have any jobs marked as "In Progress" or "Booked" right now.</p>
                  <ProjectDialog mode="create" trigger={<Button className="mt-4">Start a Project</Button>} />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeProjects.slice(0, 4).map(project => (
                  <DashboardProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 4. Sidebar (Activity & Insights) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest updates across all projects</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              <ActivityFeed projects={projects} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Pro Tip</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Did you know? Sending quotes within 24 hours increases acceptance rates by 40%.
                <br /><br />
                <span className="font-medium text-foreground cursor-pointer hover:underline" onClick={() => setLocation('/quotes')}>Review Draft Quotes →</span>
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
