import { Switch, Route, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Clients from "@/pages/Clients";
import Quotes from "@/pages/Quotes";
import Schedule from "@/pages/Schedule";
import Profile from "@/pages/Profile";
import Organization from "@/pages/Organization";
import AppSettings from "@/pages/AppSettings";
import AdminPage from "@/pages/Admin";
import Login from "@/pages/Login";
import ClientPortal from "@/pages/ClientPortal";
import Catalog from "@/pages/Catalog";
import AllQuotes from "@/pages/AllQuotes";
import NotFound from "@/pages/not-found";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-screen w-full">
      <AppSidebar />
      <div
        className="flex flex-col flex-1">
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import { PublicLayout } from "@/components/PublicLayout";
import { OrgSetup } from "@/components/OrgSetup";
import { useAuth } from "@/contexts/AuthContext";

function Router() {
  const { user, claims, loading } = useAuth();
  const [location] = useLocation();
  const isPublicRoute = location === "/login" || location.startsWith("/portal");

  if (loading) {
    // You might want to show a global loading spinner here
    return null;
  }

  // If user is logged in but has no orgs, show the setup screen
  if (user && claims && claims.orgIds.length === 0) {
    return <OrgSetup onOrgIdSet={() => window.location.reload()} />;
  }

  if (isPublicRoute) {
    return (
      <PublicLayout>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/portal/:token" component={ClientPortal} />
          <Route component={NotFound} />
        </Switch>
      </PublicLayout>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/clients" component={Clients} />
          <Route path="/projects/:projectId/quotes" component={Quotes} />
          <Route path="/quotes" component={AllQuotes} />
          <Route path="/schedule" component={Schedule} />

          {/* Settings Routes */}
          <Route path="/settings" component={AppSettings} />
          <Route path="/profile" component={Profile} />
          <Route path="/organization" component={Organization} />

          <Route path="/catalog" component={Catalog} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </ProtectedRoute>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <Router />
    </SidebarProvider>
  );
}

export default App;
