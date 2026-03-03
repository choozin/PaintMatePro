import React from 'react';
import { useLocation, useParams } from 'wouter';
import { useProject } from '@/hooks/useProjects';
import { useRooms } from '@/hooks/useRooms';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { MapPin, Calendar, Clock, ArrowLeft, ArrowRight, Paintbrush, Loader2, Ruler } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

export default function ProjectSnapshot() {
    const [, setLocation] = useLocation();
    const { id } = useParams<{ id: string }>();
    const { data: project, isLoading: projectLoading } = useProject(id);
    const { data: rooms, isLoading: roomsLoading } = useRooms(id);
    const { currentPermissions, org } = useAuth();

    // Permissions check
    const canViewFullDetails = hasPermission(currentPermissions, 'view_projects');
    const canViewSnapshot = hasPermission(currentPermissions, 'view_project_snapshot');

    React.useEffect(() => {
        if (!canViewSnapshot && !canViewFullDetails) {
            setLocation('/');
        }
    }, [canViewSnapshot, canViewFullDetails, setLocation]);

    if (projectLoading || roomsLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
                <h2 className="text-xl font-semibold">Project not found</h2>
                <Button onClick={() => setLocation('/schedule')}>Back to Schedule</Button>
            </div>
        );
    }

    // Status styling helper
    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            new: "bg-teal-100 text-teal-800",
            lead: "bg-blue-100 text-blue-800",
            quoted: "bg-purple-100 text-purple-800",
            booked: "bg-indigo-100 text-indigo-800",
            "in-progress": "bg-emerald-100 text-emerald-800",
            paused: "bg-amber-100 text-amber-800",
            completed: "bg-slate-100 text-slate-600",
            invoiced: "bg-yellow-100 text-yellow-800",
            paid: "bg-green-100 text-green-800"
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    };

    // Address Visibility Logic
    const daysVisibleSetting = org?.snapshotAddressDaysVisible ?? 7;
    let isAddressVisible = false;

    if (canViewFullDetails) {
        // Admins/Managers can always see the address
        isAddressVisible = true;
    } else if (project.startDate) {
        // Field workers check the days before start
        const startDate = (project.startDate as any).toDate ? (project.startDate as any).toDate() : new Date(project.startDate as any);
        const daysUntilStart = differenceInDays(startDate, new Date());
        isAddressVisible = daysUntilStart <= daysVisibleSetting;
    }

    // Job Scope Visibility Logic
    const isScopeVisible = canViewFullDetails || (org?.snapshotJobScopeVisible !== false);

    const renderAddress = () => {
        if (!project.address) return <div className="text-muted-foreground italic text-sm">No address provided</div>;

        if (typeof project.address === 'string') {
            const trimmed = project.address.trim();
            if (!trimmed) return <div className="text-muted-foreground italic text-sm">No address provided</div>;
            return <div className="text-base whitespace-pre-wrap">{trimmed}</div>;
        }

        const addr = project.address as any;
        const street = addr.street1 || addr.street;
        if (!street && !addr.city && !addr.state && !addr.zip) {
            return <div className="text-muted-foreground italic text-sm">No address provided</div>;
        }

        return (
            <div className="text-base">
                {street && <div>{street}</div>}
                {addr.street2 && <div>{addr.street2}</div>}
                {(addr.city || addr.state || addr.zip) && (
                    <div>
                        {[addr.city, addr.state].filter(Boolean).join(', ')} {addr.zip}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container mx-auto max-w-4xl py-6 space-y-6">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <Button variant="ghost" onClick={() => setLocation('/schedule')} className="pl-0 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Schedule
                </Button>

                {canViewFullDetails && (
                    <Button onClick={() => setLocation(`/projects/${project.id}`)}>
                        View Full Details <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Main Title Card */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-3xl font-bold">{project.name}</CardTitle>
                            <CardDescription className="text-lg mt-1">{project.type === ('interior' as any) ? 'Interior Painting' : project.type === ('exterior' as any) ? 'Exterior Painting' : 'Painting Project'}</CardDescription>
                        </div>
                        <Badge className={`text-sm py-1 px-3 capitalize ${getStatusColor(project.status || 'new')}`}>
                            {project.status?.replace('-', ' ') || 'New'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                        {/* Address */}
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-1">Project Address</h4>
                                {isAddressVisible ? (
                                    renderAddress()
                                ) : (
                                    <div className="text-muted-foreground italic text-sm">
                                        Address hidden until {daysVisibleSetting === 0 ? 'start day' : `${daysVisibleSetting} days before start`}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-1">Schedule</h4>
                                {project.startDate ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">Start:</span>
                                            <span>{format((project.startDate as any).toDate ? (project.startDate as any).toDate() : new Date(project.startDate as any), 'MMM d, yyyy')}</span>
                                            <span className="text-muted-foreground text-sm ml-1 flex items-center">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {format((project.startDate as any).toDate ? (project.startDate as any).toDate() : new Date(project.startDate as any), 'h:mm a')}
                                            </span>
                                        </div>
                                        {project.estimatedCompletion && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">Est. End:</span>
                                                <span>{format((project.estimatedCompletion as any).toDate ? (project.estimatedCompletion as any).toDate() : new Date(project.estimatedCompletion as any), 'MMM d, yyyy')}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground italic text-sm">Not scheduled yet</div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Job Details Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Paintbrush className="h-5 w-5" /> Job Details & Scope
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!isScopeVisible ? (
                        <div className="bg-muted/30 p-6 rounded-lg text-center border border-dashed">
                            <p className="text-muted-foreground italic">
                                Detailed job scope and room information is hidden per organization settings.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Notes */}
                            <div className="bg-muted/50 p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">Project Notes</h4>
                                <div className="whitespace-pre-wrap text-sm">
                                    {project.notes || <span className="text-muted-foreground italic">No general notes provided for this project.</span>}
                                </div>
                            </div>

                            {/* Room Breakdown (if interior) or general specs */}
                            {rooms && rooms.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-3">Area Breakdown</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {rooms.map((room: any) => (
                                            <div key={room.id} className="border rounded-md p-3 text-sm flex flex-col justify-between">
                                                <div>
                                                    <div className="font-medium mb-1 truncate">{room.name}</div>

                                                    {/* Dimensions & Info */}
                                                    <div className="flex gap-2 flex-wrap text-muted-foreground text-xs mb-2">
                                                        {(room.length || room.width || room.height) && (
                                                            <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                                                                <Ruler className="h-3 w-3" />
                                                                {room.length}x{room.width}x{room.height}ft
                                                            </span>
                                                        )}
                                                        {(room.color || room.colorName) && (
                                                            <span className="bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                {room.color?.startsWith('#') && (
                                                                    <div className="w-2 h-2 rounded-full border border-slate-300" style={{ backgroundColor: room.color }} />
                                                                )}
                                                                {room.colorName || room.color}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-muted-foreground text-xs space-y-1 mt-3">
                                                        {/* Walls (Always assumed unless explicitly removed, but fallback to global config) */}
                                                        <div>
                                                            <span className="font-medium text-foreground">Walls:</span>{' '}
                                                            {room.supplyConfig?.wallProduct?.name || project.supplyConfig?.wallProduct?.name || project.paintConfig?.wallProduct?.name || 'Standard Wall Paint'}
                                                            {' '}({room.supplyConfig?.wallCoats ?? project.supplyConfig?.wallCoats ?? project.paintConfig?.wallCoats ?? 2} coats)
                                                        </div>

                                                        {/* Ceiling */}
                                                        {(room.supplyConfig?.includeCeiling ?? project.supplyConfig?.includeCeiling ?? project.paintConfig?.includeCeiling) && (
                                                            <div>
                                                                <span className="font-medium text-foreground">Ceiling:</span>{' '}
                                                                {room.supplyConfig?.ceilingProduct?.name || project.supplyConfig?.ceilingProduct?.name || project.paintConfig?.ceilingProduct?.name || 'Standard Ceiling Paint'}
                                                                {' '}({room.supplyConfig?.ceilingCoats ?? project.supplyConfig?.ceilingCoats ?? project.paintConfig?.ceilingCoats ?? 2} coats)
                                                            </div>
                                                        )}

                                                        {/* Trim */}
                                                        {(room.supplyConfig?.includeTrim ?? project.supplyConfig?.includeTrim ?? project.paintConfig?.includeTrim) && (
                                                            <div>
                                                                <span className="font-medium text-foreground">Trim:</span>{' '}
                                                                {room.supplyConfig?.trimProduct?.name || project.supplyConfig?.trimProduct?.name || project.paintConfig?.trimProduct?.name || 'Standard Trim Paint'}
                                                                {' '}({room.supplyConfig?.trimCoats ?? project.supplyConfig?.trimCoats ?? project.paintConfig?.trimCoats ?? 2} coats)
                                                            </div>
                                                        )}

                                                        {/* Primer */}
                                                        {(room.supplyConfig?.requirePrimer ?? project.supplyConfig?.requirePrimer ?? project.paintConfig?.includePrimer) && (
                                                            <div>
                                                                <span className="font-medium text-foreground">Primer:</span>{' '}
                                                                {room.supplyConfig?.primerProduct?.name || project.supplyConfig?.primerProduct?.name || project.paintConfig?.primerProduct?.name || 'Standard Primer'}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Work Items & Prep */}
                                                    {(room.miscItems?.length > 0 || room.prepTasks?.length > 0) && (
                                                        <div className="mt-3 pt-2 text-xs">
                                                            <span className="font-semibold text-foreground mb-1 block">Work Items & Prep:</span>
                                                            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                                                                {room.miscItems?.map((misc: any) => (
                                                                    <li key={misc.id}>{misc.name} ({misc.quantity} {misc.unit === 'units' ? 'items' : misc.unit})</li>
                                                                ))}
                                                                {room.prepTasks?.filter((t: any) => !t.excluded).map((prep: any) => (
                                                                    <li key={prep.id}>{prep.name} {prep.quantity ? `(${prep.quantity})` : ''}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                {room.notes && (
                                                    <div className="mt-2 text-xs italic text-muted-foreground border-t pt-1 mt-auto whitespace-pre-wrap">
                                                        {room.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
