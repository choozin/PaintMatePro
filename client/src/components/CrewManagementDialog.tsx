import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crewOperations, employeeOperations, Project, Crew, projectOperations } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, Users, RefreshCw, Trash2 } from "lucide-react";
import { getContrastColor, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CrewManagementDialogProps {
    project: Project & { id: string };
    currentCrew: Crew;
    trigger: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CrewManagementDialog({ project, currentCrew, trigger, open, onOpenChange }: CrewManagementDialogProps) {
    const { org } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [internalOpen, setInternalOpen] = useState(false);
    const [selectedCrewId, setSelectedCrewId] = useState<string>(currentCrew.id);

    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;
    const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

    // Fetch all crews for the org (for switching)
    const { data: allCrews } = useQuery({
        queryKey: ['crews', org?.id],
        queryFn: () => crewOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    // Fetch all employees (to resolve member names)
    const { data: employees } = useQuery({
        queryKey: ['employees', org?.id],
        queryFn: () => employeeOperations.getByOrg(org!.id),
        enabled: !!org,
    });

    // Update Project Mutation
    const updateProjectMutation = useMutation({
        mutationFn: ({ assignedCrewId }: { assignedCrewId: string | null }) =>
            projectOperations.update(project.id, { assignedCrewId } as any),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['project', project.id] });
            queryClient.invalidateQueries({ queryKey: ['crew', variables.assignedCrewId] });

            toast({
                title: variables.assignedCrewId ? "Crew Reassigned" : "Crew Unassigned",
                description: variables.assignedCrewId
                    ? `Project assigned to ${allCrews?.find(c => c.id === variables.assignedCrewId)?.name}`
                    : "Project is now unassigned."
            });

            if (setIsOpen) setIsOpen(false);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to update crew assignment.",
                variant: "destructive"
            });
            console.error(error);
        }
    });

    const handleSwitchCrew = () => {
        if (selectedCrewId && selectedCrewId !== currentCrew.id) {
            updateProjectMutation.mutate({ assignedCrewId: selectedCrewId });
        }
    };

    const handleUnassign = () => {
        if (confirm("Are you sure you want to unassign the current crew from this project?")) {
            updateProjectMutation.mutate({ assignedCrewId: null });
        }
    };

    // Get members of the current crew
    const currentMembers = currentCrew.memberIds?.map(mId =>
        employees?.find(e => e.id === mId)
    ).filter(Boolean) || [];

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Assigned Crew</DialogTitle>
                    <DialogDescription>
                        View details for <strong>{currentCrew.name}</strong> or reassign logic.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Current Crew Card */}
                    <div
                        className="rounded-lg border p-4 shadow-sm"
                        style={{
                            backgroundColor: currentCrew.color ? `${currentCrew.color}15` : undefined,
                            borderColor: currentCrew.color ? `${currentCrew.color}40` : undefined
                        }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className="p-2 rounded-full"
                                style={{ backgroundColor: currentCrew.color || '#e2e8f0' }}
                            >
                                <Users className={cn("h-5 w-5", currentCrew.color && getContrastColor(currentCrew.color) === 'black' ? 'text-black' : 'text-white')} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">{currentCrew.name}</h3>
                                <p className="text-xs text-muted-foreground">{currentMembers.length} Members Assigned</p>
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="space-y-2 mt-4">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Crew Members</h4>
                            <div className="flex flex-wrap gap-2">
                                {currentMembers.length > 0 ? (
                                    currentMembers.map(member => (
                                        <Badge key={member!.id} variant="secondary" className="bg-background/80 hover:bg-background border-input">
                                            <User className="h-3 w-3 mr-1 opacity-70" />
                                            {member!.name}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-sm text-muted-foreground italic">No members assigned to this crew.</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4 pt-2 border-t">
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">Reassign Project</h4>
                            <div className="flex gap-2">
                                <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select a crew" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allCrews?.map(crew => (
                                            <SelectItem key={crew.id} value={crew.id}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: crew.color }}
                                                    />
                                                    {crew.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={handleSwitchCrew}
                                    disabled={selectedCrewId === currentCrew.id || updateProjectMutation.isPending}
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Switch
                                </Button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={handleUnassign}
                                disabled={updateProjectMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Unassign Current Crew
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
