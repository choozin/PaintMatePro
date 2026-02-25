import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { BusinessHealth } from "@/components/dashboard/BusinessHealth";
import { MyWork } from "@/components/dashboard/MyWork";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useProjects } from "@/hooks/useProjects";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { currentPermissions, currentOrgRole } = useAuth();
  const { data: projects = [] } = useProjects();
  const [, setLocation] = useLocation();

  // Permission Checks
  const canViewFinancials = hasPermission(currentPermissions, 'view_financials');
  const canViewAllProjects = hasPermission(currentPermissions, 'view_projects');
  // Simple check: if they cant view financials (Painter/Foreman), show MyWork
  const showOperationalView = !canViewFinancials;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* 1. Header (Universal) */}
      <DashboardHeader />

      {/* 2. Quick Actions (Universal - Internal logic handles roles) */}
      <QuickActions />

      {/* 3. Role-Based Widgets */}

      {/* A. Admin / Business View */}
      {canViewFinancials && (
        <>
          <BusinessHealth />
        </>
      )}

      {/* B. Operational / Field View */}
      {showOperationalView && (
        <MyWork />
      )}

      {/* 4. Shared Widgets (Activity Stream & Recent items) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Feed */}
        <div className="lg:col-span-2">
          {canViewAllProjects && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold tracking-tight">Active Projects</h2>
                <Button variant="ghost" size="sm" onClick={() => setLocation('/projects')}>View All <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </div>
              {/* We can re-use the Project Cards grid here if desired, or keep it cleaner */}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              <ActivityFeed projects={projects} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Widgets (Notifications, Tips) */}
        <div className="space-y-6">
          {/* Maybe a 'System Status' or 'Weather' widget here later */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Pro Tip</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Reviewing the schedule on Sunday evening reduces Monday morning confusion by 60%.
              </p>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
