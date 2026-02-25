import { ReactNode } from "react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { Project } from "@/lib/firestore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Phone, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext"; // We might use this for org branding later

interface PortalLayoutProps {
    children: ReactNode;
    orgName?: string;
    clientName?: string;
    onLogout?: () => void;
    // New props for Switcher
    projects?: Project[];
    currentProjectId?: string;
    onSwitchProject?: (id: string) => void;
}

export function PortalLayout({
    children,
    orgName = "PaintPro",
    clientName,
    onLogout,
    projects = [],
    currentProjectId,
    onSwitchProject
}: PortalLayoutProps) {
    // This layout is designed to be "Concierge" style.
    // Clean, centered, minimal distractions. 

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-primary/20">
            {/* Top Bar: Contact & Branding */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 font-bold text-xl tracking-tight mr-4">
                            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                                P
                            </div>
                            <span className="hidden sm:inline-block">{orgName}</span>
                        </div>

                        {/* Project Switcher (Visible if authenticated and multiple projects exist, or just general context) */}
                        {currentProjectId && onSwitchProject && (
                            <ProjectSwitcher
                                projects={projects}
                                currentProjectId={currentProjectId}
                                onSelectProject={onSwitchProject}
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Desktop Contact Info */}
                        <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground mr-4">
                            <span className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer">
                                <Phone className="h-4 w-4" /> (555) 123-4567
                            </span>
                            <span className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer">
                                <Mail className="h-4 w-4" /> help@paintmate.com
                            </span>
                        </div>

                        <ThemeToggle />

                        {clientName && (
                            <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-foreground">
                                Sign Out
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="container mx-auto max-w-6xl px-4 py-8 md:py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t py-8 mt-12 bg-white dark:bg-slate-900">
                <div className="container mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} {orgName}. All rights reserved.</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">Powered by PaintMate Pro</p>
                </div>
            </footer>
        </div>
    );
}
