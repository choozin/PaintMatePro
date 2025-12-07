import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Calendar,
  Settings,
  LogOut,
  Shield,
  User,
  Building2,
  SlidersHorizontal
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, claims, currentOrgRole, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const { t } = useTranslation();

  const menuItems = [
    {
      title: t('nav.dashboard'),
      url: "/",
      icon: LayoutDashboard,
      testId: "dashboard"
    },
    {
      title: t('nav.schedule'),
      url: "/schedule",
      icon: Calendar,
      testId: "schedule"
    },
    {
      title: t('nav.projects'),
      url: "/projects",
      icon: FolderKanban,
      testId: "projects"
    },
    {
      title: "Leads & Clients",
      url: "/clients",
      icon: Users,
      testId: "clients"
    },
    {
      title: t('nav.quotes'),
      url: "/quotes",
      icon: FileText,
      testId: "quotes"
    },
    {
      title: "Catalog",
      url: "/catalog",
      icon: FolderKanban,
      testId: "catalog"
    },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
      setLocation('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNav = (url: string) => {
    setLocation(url);
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  const canManageOrg = currentOrgRole === 'owner' || currentOrgRole === 'admin';
  const isGlobalAdmin = claims?.role === 'owner' || claims?.role === 'admin';

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-semibold px-4 py-6">
            {t('app.name')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.testId}`}
                  >
                    <a href={item.url} onClick={(e) => { e.preventDefault(); handleNav(item.url); }}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t space-y-4">
        <div className="px-4 py-2 space-y-1">
          <p className="font-semibold text-sm">{user?.displayName || 'User'}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <div className="text-xs text-muted-foreground pt-2">
            <p>Global Role: <span className="font-medium text-foreground">{claims?.role || 'N/A'}</span></p>
            <p>Org Role: <span className="font-medium text-foreground">{currentOrgRole || 'N/A'}</span></p>
          </div>
        </div>

        <SidebarMenu>
          {/* Admin Link (Moved to bottom) */}
          {isGlobalAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === '/admin'} data-testid="link-admin">
                <a href="/admin" onClick={(e) => { e.preventDefault(); handleNav('/admin'); }}>
                  <Shield className="h-5 w-5" />
                  <span>{t('nav.admin')}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Profile Settings */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === '/profile'} data-testid="link-profile">
              <a href="/profile" onClick={(e) => { e.preventDefault(); handleNav('/profile'); }}>
                <User className="h-5 w-5" />
                <span>{t('nav.profile')}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Organization Settings (Conditional) */}
          {canManageOrg && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === '/organization'} data-testid="link-org-settings">
                <a href="/organization" onClick={(e) => { e.preventDefault(); handleNav('/organization'); }}>
                  <Building2 className="h-5 w-5" />
                  <span>{t('nav.organization')}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* App Settings */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === '/settings'} data-testid="link-app-settings">
              <a href="/settings" onClick={(e) => { e.preventDefault(); handleNav('/settings'); }}>
                <Settings className="h-5 w-5" />
                <span>{t('nav.settings')}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-5 w-5" />
              <span>{t('nav.logout')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
