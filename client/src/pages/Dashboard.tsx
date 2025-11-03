import { StatCard } from "@/components/StatCard";
import { ProjectCard } from "@/components/ProjectCard";
import { DollarSign, FolderKanban, Users, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Dashboard() {
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
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back! Here's your business overview.</p>
        </div>
        <Button data-testid="button-new-project">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
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
          value="12"
          icon={FolderKanban}
          trend={{ value: "+2 from last week", isPositive: true }}
          testId="card-projects"
        />
        <StatCard
          title="Total Clients"
          value="38"
          icon={Users}
          trend={{ value: "+5 this month", isPositive: true }}
          testId="card-clients"
        />
        <StatCard
          title="Completed Jobs"
          value="156"
          icon={CheckCircle}
          trend={{ value: "+8 this month", isPositive: true }}
          testId="card-completed"
        />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-6">Recent Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProjects.map((project) => (
            <ProjectCard
              key={project.id}
              {...project}
              onClick={() => console.log(`View project ${project.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
