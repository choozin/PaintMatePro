import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");

  const mockProjects = [
    {
      id: "1",
      name: "Residential Exterior Paint",
      clientName: "John Smith",
      status: "in-progress" as const,
      location: "123 Main St, Oakland, CA",
      startDate: "Jan 15, 2025",
      estimatedCompletion: "Jan 30, 2025",
    },
    {
      id: "2",
      name: "Office Interior Refresh",
      clientName: "Tech Startup Inc",
      status: "pending" as const,
      location: "456 Market St, San Francisco, CA",
      startDate: "Feb 1, 2025",
    },
    {
      id: "3",
      name: "Apartment Complex",
      clientName: "Property Management LLC",
      status: "in-progress" as const,
      location: "789 Oak Ave, Berkeley, CA",
      startDate: "Jan 20, 2025",
      estimatedCompletion: "Feb 15, 2025",
    },
    {
      id: "4",
      name: "Commercial Storefront",
      clientName: "Retail Corp",
      status: "completed" as const,
      location: "321 Elm St, Oakland, CA",
      startDate: "Dec 1, 2024",
      estimatedCompletion: "Dec 20, 2024",
    },
    {
      id: "5",
      name: "Warehouse Exterior",
      clientName: "Logistics Inc",
      status: "on-hold" as const,
      location: "555 Industrial Pkwy, Fremont, CA",
      startDate: "Jan 10, 2025",
    },
  ];

  const filteredProjects = mockProjects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-2">Manage all your painting projects.</p>
        </div>
        <Button data-testid="button-create-project">
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.id}
            {...project}
            onClick={() => console.log(`View project ${project.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
