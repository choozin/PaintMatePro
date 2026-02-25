import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { CloudSun } from "lucide-react";

export function DashboardHeader() {
    const { user, org } = useAuth();
    const firstName = user?.displayName?.split(' ')[0] || 'There';
    const today = new Date();

    const getGreeting = () => {
        const hour = today.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6">
            <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                    <span>{format(today, 'EEEE, MMMM do')}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="flex items-center gap-1">
                        <CloudSun className="h-3 w-3" />
                        <span>72°F</span>
                    </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                    {getGreeting()}, <span className="text-primary">{firstName}</span>.
                </h1>
                <p className="text-muted-foreground mt-1 text-lg max-w-2xl">
                    Welcome to your command center for <span className="font-semibold text-foreground/80">{org?.name}</span>.
                </p>
            </div>
        </div>
    );
}
