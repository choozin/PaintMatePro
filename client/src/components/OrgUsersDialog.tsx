import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsers } from '@/hooks/useUsers';
import { useDeleteUser } from '@/hooks/useDeleteUser';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AddUserDialog } from './AddUserDialog';

interface OrgUsersDialogProps {
    orgId: string;
    orgName: string;
    children: React.ReactNode;
}

export function OrgUsersDialog({ orgId, orgName, children }: OrgUsersDialogProps) {
    const { data: users, isLoading, error } = useUsers(orgId);
    const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
    const { toast } = useToast();

    const handleDeleteUser = (userId: string) => {
        deleteUser(userId, {
            onSuccess: () => {
                toast({
                    title: "User Deleted",
                    description: "The user has been permanently deleted.",
                });
            },
            onError: (error: any) => {
                toast({
                    variant: "destructive",
                    title: "Deletion Failed",
                    description: error.message,
                });
            },
        });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <DialogTitle>Manage Users for {orgName}</DialogTitle>
                        <DialogDescription>
                            View and manage users belonging to this organization.
                        </DialogDescription>
                    </div>
                    <AddUserDialog orgId={orgId} />
                </DialogHeader>
                <div className="py-4">
                    {isLoading && (
                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    )}
                    {error && (
                        <div className="text-destructive text-sm">Failed to load users: {error.message}</div>
                    )}
                    {!isLoading && users && users.length === 0 && (
                        <p className="text-muted-foreground">No users found for this organization.</p>
                    )}
                    {!isLoading && users && users.length > 0 && (
                        <div className="space-y-3">
                            {users.map((user) => (
                                <div key={user.uid} className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-card">
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.displayName || 'Unnamed User'}</span>
                                        <span className="text-sm text-muted-foreground">{user.email}</span>
                                    </div>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the user account
                                                    <strong> {user.email}</strong> and remove their data from our servers.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDeleteUser(user.uid)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    disabled={isDeleting}
                                                >
                                                    {isDeleting ? "Deleting..." : "Delete User"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
