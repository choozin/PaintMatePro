import React from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { user, loading } = useAuth();

  // Sidebar should be open by default if not logged in and not loading auth state
  const defaultSidebarOpen = !loading && !user;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 grid place-items-center bg-muted/30 p-4">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
