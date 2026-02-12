import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { orgRoleOperations, OrgRoleDef, roleTemplateOperations } from '@/lib/firestore';
import { Button } from "@/components/ui/button";
import { Plus, Shield, MoreVertical, Pencil, Trash2, Users } from "lucide-react";
import { RoleEditorDialog } from '@/components/dialogs/RoleEditorDialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Permission, getLegacyFallbackPermissions } from '@/lib/permissions';

export function RolesSettings() {
    const { currentOrgId } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [selectedRole, setSelectedRole] = useState<OrgRoleDef | undefined>(undefined);
    const [roleToDelete, setRoleToDelete] = useState<OrgRoleDef | null>(null);

    // Fetch Roles
    const { data: roles = [], isLoading } = useQuery({
        queryKey: ['orgRoles', currentOrgId],
        queryFn: async () => {
            if (!currentOrgId) return [];
            return await orgRoleOperations.getByOrg(currentOrgId);
        },
        enabled: !!currentOrgId,
        select: (data) => data.sort((a: any, b: any) => a.name.localeCompare(b.name))
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (data: { name: string; description: string; permissions: Permission[] }) => {
            if (!currentOrgId) throw new Error("No Org ID");
            return await orgRoleOperations.create({
                orgId: currentOrgId,
                name: data.name,
                description: data.description,
                permissions: data.permissions
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orgRoles', currentOrgId] });
        }
    });

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: async (data: { id: string; name: string; description: string; permissions: Permission[] }) => {
            return await orgRoleOperations.update(data.id, {
                name: data.name,
                description: data.description,
                permissions: data.permissions
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orgRoles', currentOrgId] });
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await orgRoleOperations.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orgRoles', currentOrgId] });
            toast({ title: "Role Deleted", description: "The role has been permanently removed." });
            setRoleToDelete(null);
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete role.", variant: "destructive" });
        }
    });

    const handleCreate = () => {
        setDialogMode('create');
        setSelectedRole(undefined);
        setIsDialogOpen(true);
    };

    const handleEdit = (role: OrgRoleDef) => {
        setDialogMode('edit');
        setSelectedRole(role);
        setIsDialogOpen(true);
    };

    const handleSave = async (data: { name: string; description: string; permissions: Permission[] }) => {
        if (dialogMode === 'create') {
            await createMutation.mutateAsync(data);
        } else {
            if (selectedRole?.id) {
                await updateMutation.mutateAsync({ id: selectedRole.id, ...data });
            }
        }
    };

    const handleInitializeDefaults = async () => {
        if (!currentOrgId) return;
        try {
            // 1. Fetch Global Templates
            const templates = await roleTemplateOperations.getAll();

            if (templates.length > 0) {
                // 2. Use Templates
                await Promise.all(templates.map(template => {
                    let finalName = template.name;
                    // Check for duplicates (case-insensitive)
                    const isDuplicate = roles.some(role => role.name.toLowerCase() === finalName.toLowerCase());
                    if (isDuplicate) {
                        finalName = `${finalName} (Default)`;
                    }

                    return orgRoleOperations.create({
                        orgId: currentOrgId,
                        name: finalName,
                        description: template.description,
                        permissions: template.defaultPermissions,
                        isSystemProtected: template.isSystemDefault
                    });
                }));
                toast({ title: "Roles Initialized", description: `Created ${templates.length} roles from global templates.` });
            } else {
                // 3. Fallback to Hardcoded (Legacy Safety)
                console.warn("No Global Role Templates found. Using hardcoded fallback.");
                const defaults = ['org_owner', 'org_admin', 'manager', 'estimator', 'foreman', 'painter'];
                await Promise.all(defaults.map(roleKey => {
                    const formattedName = roleKey.replace('org_', '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const finalName = roleKey === 'org_owner' ? 'Owner' : (roleKey === 'org_admin' ? 'Admin' : formattedName);

                    // Simple duplicate check for fallback too
                    let nameToUse = finalName;
                    if (roles.some(role => role.name.toLowerCase() === nameToUse.toLowerCase())) {
                        nameToUse = `${nameToUse} (Default)`;
                    }

                    return orgRoleOperations.create({
                        orgId: currentOrgId,
                        name: nameToUse,
                        description: `Standard ${finalName} role`,
                        permissions: getLegacyFallbackPermissions(roleKey),
                        isSystemProtected: roleKey === 'org_owner'
                    });
                }));
                toast({ title: "Roles Initialized", description: "Default roles created (Fallback Mode)." });
            }

            queryClient.invalidateQueries({ queryKey: ['orgRoles', currentOrgId] });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to initialize roles.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>;
    }

    // Adapt selectedRole to match RoleEditorDialog props (handle undefined description)
    const initialData = selectedRole ? {
        name: selectedRole.name,
        description: selectedRole.description || '',
        permissions: selectedRole.permissions
    } : undefined;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold">Roles & Permissions</h2>
                    <p className="text-muted-foreground">Manage user roles and access levels for your organization.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleInitializeDefaults}>
                        Import Defaults
                    </Button>
                    <Button onClick={handleCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Custom Role
                    </Button>
                </div>
            </div>

            {/* TODO: Implement Plan-Gated logic. Future: Check Org Entitlements before allowing specific permission toggles. */}

            <div className="grid gap-4">
                {roles.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg bg-muted/10">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                        <h3 className="text-lg font-medium">No Roles Found</h3>
                        <p className="text-muted-foreground mb-4">Initialize the default roles to get started.</p>
                        <Button onClick={handleInitializeDefaults}>Initialize Default Roles</Button>
                    </div>
                ) : (
                    roles.map(role => (
                        <div key={role.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${role.isSystemProtected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                                    {role.isSystemProtected ? <Shield className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{role.name}</h3>
                                        {role.isSystemProtected && <Badge variant="secondary" className="text-xs">System Default</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{role.description || `${role.permissions.length} permissions enabled`}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEdit(role)}>
                                            <Pencil className="h-4 w-4 mr-2" />
                                            View / Edit
                                        </DropdownMenuItem>
                                        {!role.isSystemProtected && (
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRoleToDelete(role)}>
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <RoleEditorDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                mode={dialogMode}
                initialData={initialData}
                onSave={handleSave}
                isSystemProtected={selectedRole?.isSystemProtected}
            />

            <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Role?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the role <strong>{roleToDelete?.name}</strong>?
                            Any users assigned to this role will lose their permissions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => roleToDelete && deleteMutation.mutate(roleToDelete.id)}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
