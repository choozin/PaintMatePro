import { Project, Client, Room } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, FileText, Home, MapPin } from "lucide-react";
import { RoomCard } from "./RoomCard";
import { DocumentsTab } from "./DocumentsTab";
import { QuoteViewer } from "./QuoteViewer";

interface PortalDashboardProps {
    project: Project;
    client: Client | null;
    rooms: Room[];
    onApproveQuote?: () => void;
}

export function PortalDashboard({ project, client, rooms, onApproveQuote }: PortalDashboardProps) {
    // Mock Financials for now
    const financials = {
        total: 12500,
        paid: 5000,
        balance: 7500
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">

            {/* 1. Hero Section */}
            <section className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">
                        {project.name}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{project.address}</span>
                        <span className="text-border">|</span>
                        <Badge variant="outline" className="capitalize">{project.status}</Badge>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Quick Stats Cards could go here */}
                </div>
            </section>

            {/* 2. Main Content Tabs */}
            <Tabs defaultValue="rooms" className="space-y-6">
                <TabsList className="bg-muted/50 p-1 h-12 w-full justify-start md:w-auto overflow-x-auto">
                    <TabsTrigger value="rooms" className="px-6 h-10 gap-2">
                        <Home className="h-4 w-4" /> Rooms & Areas
                    </TabsTrigger>
                    <TabsTrigger value="quote" className="px-6 h-10 gap-2">
                        <FileText className="h-4 w-4" /> Quote
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="px-6 h-10 gap-2" disabled>
                        <Calendar className="h-4 w-4" /> Timeline (Coming Soon)
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="px-6 h-10 gap-2">
                        <FileText className="h-4 w-4" /> Documents
                    </TabsTrigger>
                    <TabsTrigger value="color" className="px-6 h-10 gap-2">
                        <div className="h-3 w-3 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500" />
                        Color Lounge
                    </TabsTrigger>
                    <TabsTrigger value="billing" className="px-6 h-10 gap-2">
                        <DollarSign className="h-4 w-4" /> Billing
                    </TabsTrigger>
                </TabsList>

                {/* ROOMS TAB */}
                <TabsContent value="rooms" className="space-y-8">
                    {/* Interior Section */}
                    {rooms.filter(r => r.type !== 'exterior').length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Home className="h-5 w-5 text-muted-foreground" />
                                <h3 className="font-semibold text-lg text-muted-foreground">Interior Spaces</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {rooms.filter(r => r.type !== 'exterior').map(room => (
                                    <RoomCard key={room.id} room={room} projectId={project.id} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Exterior Section */}
                    {rooms.filter(r => r.type === 'exterior').length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-5 w-5 flex items-center justify-center rounded bg-green-100 text-green-700 font-bold text-[10px]">Ex</div>
                                <h3 className="font-semibold text-lg text-muted-foreground">Exterior Surfaces</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {rooms.filter(r => r.type === 'exterior').map(room => (
                                    <RoomCard key={room.id} room={room} projectId={project.id} />
                                ))}
                            </div>
                        </div>
                    )}

                    {rooms.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No spaces or areas have been added to this project yet.
                        </div>
                    )}
                </TabsContent>

                {/* QUOTE TAB */}
                <TabsContent value="quote">
                    <QuoteViewer
                        project={project}
                        client={client}
                        onApprove={onApproveQuote}
                    />
                </TabsContent>

                {/* DOCUMENTS TAB */}
                <TabsContent value="documents">
                    <DocumentsTab projectId={project.id} />
                </TabsContent>

                {/* COLOR LOUNGE TAB */}
                <TabsContent value="color">
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
                            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-20 flex items-center justify-center">
                                <span className="text-4xl">🎨</span>
                            </div>
                            <h2 className="text-2xl font-bold">Color Lounge</h2>
                            <p className="text-muted-foreground max-w-md">
                                Coming Soon: Visualize your space with different colors, see real-time previews, and select your perfect palette.
                            </p>
                            <Button variant="outline">Join Waitlist</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* BILLING TAB */}
                <TabsContent value="billing">
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
                            <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                <DollarSign className="h-10 w-10" />
                            </div>
                            <h2 className="text-2xl font-bold">Unified Billing</h2>
                            <p className="text-muted-foreground max-w-md">
                                Review invoices, make secure payments, and track your payment history all in one place.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

        </div>
    );
}
