import { ProjectCard } from "@/components/ProjectCard";
import { ProjectDialog } from "@/components/ProjectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useProjects } from "@/hooks/useProjects";
import { useClient, useClients } from "@/hooks/useClients";
import { formatDate } from "@/lib/utils/dateFormat";
import type { Project } from "@/lib/firestore";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crewOperations } from "@/lib/firestore";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUpDown, Filter } from "lucide-react";

import { Crew } from "@/lib/firestore";

function ProjectCardWithClient({ project, crews }: { project: Project & { id: string }, crews: Crew[] }) {
  const [, setLocation] = useLocation();
  const { data: client } = useClient(project.clientId);

  const assignedCrew = project.assignedCrewId ? crews.find(c => c.id === project.assignedCrewId) : undefined;
  const showCrew = ['booked', 'in-progress'].includes(project.status) && assignedCrew;

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
      crewName={showCrew ? assignedCrew?.name : undefined}
    />
  );
}

import { useTranslation } from "react-i18next";

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: projects = [], isLoading } = useProjects();
  const { t } = useTranslation();
  const searchString = useSearch();
  const queryParams = new URLSearchParams(searchString);
  const filterClientId = queryParams.get('clientId');
  const { data: filterClient } = useClient(filterClientId || null);
  const { currentOrgId } = useAuth();
  const [, setLocation] = useLocation();

  // Local Filters State
  const [statusFilter, setStatusFilter] = useState("all");
  const [crewFilter, setCrewFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date"); // date, status, name

  // Fetch Crews for Filter
  const { data: crews = [] } = useQuery({
    queryKey: ['crews', currentOrgId],
    queryFn: () => crewOperations.getByOrg(currentOrgId),
    enabled: !!currentOrgId
  });

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClient = filterClientId ? project.clientId === filterClientId : true;
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesCrew = crewFilter === "all" || (project.assignedCrewId === crewFilter) || (crewFilter === 'unassigned' && !project.assignedCrewId);

    return matchesSearch && matchesClient && matchesStatus && matchesCrew;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    // Default Date (Newest first)
    const dateA = a.startDate?.seconds || 0;
    const dateB = b.startDate?.seconds || 0;
    return dateB - dateA;
  });

  const clearClientFilter = () => {
    setLocation('/projects');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">{t('projects.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('projects.subtitle')}</p>
        </div>
        <ProjectDialog mode="create" />
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {filterClientId && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-10 px-3 text-sm font-normal">
              Client: <span className="font-semibold ml-1">{filterClient?.name || '...'}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={clearClientFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          </div>
        )}

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('projects.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-projects"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={crewFilter} onValueChange={setCrewFilter}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Crew" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Crews</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {crews.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <SelectValue placeholder="Sort By" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('dashboard.loading_projects')}</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? t('projects.no_results') : t('dashboard.no_projects')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCardWithClient key={project.id} project={project} crews={crews} />
          ))}
        </div>
      )}
    </div>
  );
}
