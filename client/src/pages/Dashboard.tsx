import { StatCard } from "@/components/StatCard";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectDialog } from "@/components/ProjectDialog";
import { DollarSign, FolderKanban, Users, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useClient } from "@/hooks/useClients";
import { formatDate } from "@/lib/utils/dateFormat";
import type { Project, Client } from "@/lib/firestore";

function DashboardProjectCard({ project }: { project: Project & { id: string } }) {
  const { data: client } = useClient(project.clientId);

  return (
    <ProjectCard
      id={project.id}
      name={project.name}
      clientName={client?.name || 'Loading...'}
      status={project.status}
      location={project.location}
      startDate={formatDate(project.startDate)}
      estimatedCompletion={project.estimatedCompletion ? formatDate(project.estimatedCompletion) : undefined}
      onClick={() => console.log(`View project ${project.id}`)}
    />
  );
}

export default function Dashboard() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: clients = [], isLoading: clientsLoading } = useClients();

  const activeProjects = projects.filter(p => p.status === 'in-progress' || p.status === 'pending');
  const completedProjects = projects.filter(p => p.status === 'completed');
  const recentProjects = projects.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back! Here's your business overview.</p>
        </div>
        <ProjectDialog mode="create" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value="$48,250"
          icon={DollarSign}
          trend={{ value: "+12.5% from last month", isPositive: true }}
          testId="card-revenue"
        />
        <StatCard
          title="Active Projects"
          value={activeProjects.length}
          icon={FolderKanban}
          testId="card-projects"
        />
        <StatCard
          title="Total Clients"
          value={clients.length}
          icon={Users}
          testId="card-clients"
        />
        <StatCard
          title="Completed Jobs"
          value={completedProjects.length}
          icon={CheckCircle}
          testId="card-completed"
        />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-6">Recent Projects</h2>
        {projectsLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No projects yet. Create your first project to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentProjects.map((project) => (
              <DashboardProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
