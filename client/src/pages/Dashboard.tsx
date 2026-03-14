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
import { ArrowRight, DollarSign, AlertTriangle, Briefcase, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInvoices } from "@/hooks/useInvoices";
import { useMemo } from "react";
import { Timestamp } from "firebase/firestore";

export default function Dashboard() {
  const { currentPermissions, currentOrgRole } = useAuth();
  const { data: projects = [] } = useProjects();
  const [, setLocation] = useLocation();

  // Permission Checks
  const canViewFinancials = hasPermission(currentPermissions, 'view_financials');
  const canViewAllProjects = hasPermission(currentPermissions, 'view_projects');
  const canViewInvoices = hasPermission(currentPermissions, 'view_invoices');
  // Simple check: if they cant view financials (Painter/Foreman), show MyWork
  const showOperationalView = !canViewFinancials;

  // AR data
  const { data: invoices = [] } = useInvoices();
  const arStats = useMemo(() => {
    const outstanding = invoices
      .filter(inv => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status))
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;
    const overdueAmount = invoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    return { outstanding, overdueCount, overdueAmount };
  }, [invoices]);

  // Active projects for the dashboard cards
  const activeProjects = useMemo(() =>
    projects
      .filter(p => ['in-progress', 'booked', 'quoting'].includes(p.status))
      .slice(0, 5),
    [projects]);

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
              {activeProjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeProjects.map(p => (
                    <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/projects/${p.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{p.name}</h3>
                            {p.address && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />{p.address}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="shrink-0 ml-2 text-[10px]">
                            {p.status === 'in-progress' ? 'In Progress' : p.status === 'booked' ? 'Booked' : 'Quoting'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active projects right now.</p>
              )}
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

          {/* Accounts Receivable Widget */}
          {canViewInvoices && canViewFinancials && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Accounts Receivable</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setLocation('/invoices')}>View <ArrowRight className="ml-1 h-3 w-3" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded dark:bg-blue-900/30">
                      <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">Outstanding</span>
                  </div>
                  <span className="font-bold">${arStats.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                {arStats.overdueCount > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-red-100 rounded dark:bg-red-900/30">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="text-sm text-red-600 dark:text-red-400">{arStats.overdueCount} Overdue</span>
                    </div>
                    <span className="font-bold text-red-600 dark:text-red-400">${arStats.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

      </div>

    </div>
  );
}
