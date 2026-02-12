import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission, PERMISSION_GROUPS } from '@/lib/permissions';
import { useTranslation } from 'react-i18next';
import { useToast } from "@/hooks/use-toast";

interface RoleEditorDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: {
        name: string;
        description: string;
        permissions: Permission[];
    };
    onSave: (data: { name: string; description: string; permissions: Permission[] }) => Promise<void>;
    mode: 'create' | 'edit';
    isSystemProtected?: boolean; // If true, name/description might be locked or permissions restricted (optional)
}

export function RoleEditorDialog({
    isOpen,
    onOpenChange,
    initialData,
    onSave,
    mode,
    isSystemProtected
}: RoleEditorDialogProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setDescription(initialData?.description || '');
            setSelectedPermissions(initialData?.permissions || []);
        }
    }, [isOpen, initialData]);

    const handleSave = async () => {
        if (!name.trim()) {
            toast({
                title: "Validation Error",
                description: "Role name is required.",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSubmitting(true);
            await onSave({ name, description, permissions: selectedPermissions });
            toast({
                title: "Success",
                description: `Role ${mode === 'create' ? 'created' : 'updated'} successfully.`
            });
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to save role.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePermission = (permId: Permission) => {
        setSelectedPermissions(prev => {
            if (prev.includes(permId)) {
                return prev.filter(p => p !== permId);
            } else {
                return [...prev, permId];
            }
        });
    };

    const toggleGroup = (perms: Permission[]) => {
        const allSelected = perms.every(p => selectedPermissions.includes(p));
        if (allSelected) {
            // Deselect all
            setSelectedPermissions(prev => prev.filter(p => !perms.includes(p)));
        } else {
            // Select all
            const toAdd = perms.filter(p => !selectedPermissions.includes(p));
            setSelectedPermissions(prev => [...prev, ...toAdd]);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{mode === 'create' ? 'Create New Role' : 'Edit Role'}</DialogTitle>
                    <DialogDescription>
                        Define the permissions for this role.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 grid gap-4 border-b">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="role-name">Role Name</Label>
                            <Input
                                id="role-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Senior Estimator"
                                disabled={isSubmitting} // Removing isSystemProtected lock here to verify logic first
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role-desc">Description</Label>
                            <Input
                                id="role-desc"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Optional description"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-8">
                        {PERMISSION_GROUPS.map(group => {
                            const groupPermIds = group.permissions.map(p => p.id);
                            const allSelected = groupPermIds.every(p => selectedPermissions.includes(p));
                            const someSelected = groupPermIds.some(p => selectedPermissions.includes(p));

                            return (
                                <div key={group.id} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            {group.label}
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleGroup(groupPermIds)}
                                            className="text-xs h-6"
                                        >
                                            {allSelected ? 'Deselect All' : 'Select All'}
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {group.permissions.map(perm => (
                                            <div
                                                key={perm.id}
                                                className={`flex items-start space-x-3 p-3 rounded-md border transition-colors ${selectedPermissions.includes(perm.id) ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                                            >
                                                <Checkbox
                                                    id={perm.id}
                                                    checked={selectedPermissions.includes(perm.id)}
                                                    onCheckedChange={() => togglePermission(perm.id)}
                                                    className="mt-1"
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <Label
                                                        htmlFor={perm.id}
                                                        className="font-medium cursor-pointer"
                                                    >
                                                        {perm.label}
                                                    </Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        {perm.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Separator className="mt-4" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Role'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
