import { Button } from "@/components/ui/button";
import { Plus, FileText, Users, Clock, Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { ProjectDialog } from "@/components/ProjectDialog";
import { ClientDialog } from "@/components/ClientDialog";
import { Card } from "@/components/ui/card";

export function QuickActions() {
    const [, setLocation] = useLocation();
    const { currentPermissions } = useAuth();

    const canCreateProject = hasPermission(currentPermissions, 'create_projects');
    const canCreateClient = hasPermission(currentPermissions, 'manage_clients'); // Using manage_clients as proxy for "add lead"
    const canCreateQuote = hasPermission(currentPermissions, 'create_quotes');
    const canLogTime = hasPermission(currentPermissions, 'log_own_time');

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            {/* 1. New Lead */}
            {canCreateClient && (
                <ClientDialog mode="create" trigger={
                    <Button variant="outline" className="h-24 flex-col gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Users className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-xs">New Lead</span>
                    </Button>
                } />
            )}

            {/* 2. New Project */}
            {canCreateProject && (
                <ProjectDialog mode="create" trigger={
                    <Button variant="outline" className="h-24 flex-col gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Plus className="h-5 w-5" />
                        </div>
                        <span className="font-medium text-xs">New Project</span>
                    </Button>
                } />
            )}

            {/* 3. New Quote */}
            {canCreateQuote && (
                <Button
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => setLocation('/quotes')} // Or open a quick quote dialog if we had one
                >
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <FileText className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-xs">Draft Quote</span>
                </Button>
            )}

            {/* 4. Clock In/Out */}
            {canLogTime && (
                <Button
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    onClick={() => setLocation('/time-tracking')} // Ideally this would be an immediate action
                >
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Clock className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-xs">Clock In</span>
                </Button>
            )}

            {/* 5. Schedule */}
            <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => setLocation('/schedule')}
            >
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <CalendarIcon className="h-5 w-5" />
                </div>
                <span className="font-medium text-xs">Schedule</span>
            </Button>

        </div>
    );
}
