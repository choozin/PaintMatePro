import { ProjectCard } from "@/components/ProjectCard";
import { ProjectDialog } from "@/components/ProjectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useProjects } from "@/hooks/useProjects";
import { useClient } from "@/hooks/useClients";
import { formatDate } from "@/lib/utils/dateFormat";
import type { Project } from "@/lib/firestore";

function ProjectCardWithClient({ project }: { project: Project & { id: string } }) {
  const [, setLocation] = useLocation();
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
      onClick={() => setLocation(`/projects/${project.id}`)}
    />
  );
}

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: projects = [], isLoading } = useProjects();

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-2">Manage all your painting projects.</p>
        </div>
        <ProjectDialog mode="create" />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-projects"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? 'No projects match your search.' : 'No projects yet. Create your first project to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCardWithClient key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
