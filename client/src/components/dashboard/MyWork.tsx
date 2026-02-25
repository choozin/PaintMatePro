import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Clock, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects"; // We'll need to filter these
import { formatDate } from "@/lib/utils/dateFormat";

export function MyWork() {
    const { user } = useAuth();
    // In a real app, we'd query projects assigned to the current user (via crew or direct assignment)
    // For now we'll mock or filter client-side
    const { data: allProjects = [] } = useProjects();

    // Mock: Find projects that are 'in-progress'
    const myProjects = allProjects
        .filter(p => p.status === 'in-progress' || p.status === 'booked')
        .slice(0, 3);

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {/* 1. Today's Job */}
            <Card className="col-span-2 shadow-md border-l-4 border-l-primary">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl">Today's Job</CardTitle>
                            <CardDescription>You are scheduled at:</CardDescription>
                        </div>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Clock className="mr-2 h-4 w-4" /> Clock In
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {myProjects.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <MapPin className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{myProjects[0].name}</h3>
                                    <p className="text-muted-foreground">{myProjects[0].address || "No address provided"}</p>
                                    <div className="flex gap-2 mt-2">
                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                            Interior
                                        </span>
                                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                            Walls & Trim
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-muted/50 p-4 rounded-md">
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" /> Tasks for Today
                                </h4>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded border-gray-300" />
                                        <span>Mask flooring in Living Room</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded border-gray-300" />
                                        <span>Prime patch repairs</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded border-gray-300" />
                                        <span>First coat walls (SW 7005)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center text-muted-foreground">
                            No active jobs assigned for today. Enjoy your day off!
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. Up Next */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Up Next</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {myProjects.slice(1).map((project, i) => (
                        <div key={project.id} className="flex gap-3 items-center p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-medium truncate">{project.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {project.startDate ? formatDate(project.startDate) : 'Date TBD'}
                                </p>
                            </div>
                        </div>
                    ))}
                    {myProjects.length <= 1 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Nothing else scheduled this week.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
