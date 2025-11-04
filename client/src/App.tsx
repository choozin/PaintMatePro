import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Clients from "@/pages/Clients";
import Quotes from "@/pages/Quotes";
import Schedule from "@/pages/Schedule";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import ClientPortal from "@/pages/ClientPortal";
import NotFound from "@/pages/not-found";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full">
      <AppSidebar />
      <div className="flex flex-col flex-1">
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

function Router() {
  const [location] = useLocation();
  const isPublicRoute = location === "/login" || location.startsWith("/portal");

  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/portal/:token" component={ClientPortal} />
        <Route component={NotFound} />
      </Switch>
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
          <Route path="/quotes" component={Quotes} />
          <Route path="/schedule" component={Schedule} />
          <Route path="/settings" component={Settings} />
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <Router />
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
