import React from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUsers } from '@/hooks/useUsers';
import { useDeleteUser } from '@/hooks/useDeleteUser';
import { Skeleton } from '@/components/ui/skeleton';
import { Terminal } from 'lucide-react';

function MyProfileCard() {
  const { user, sendPasswordReset, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [isPasswordLoading, setIsPasswordLoading] = React.useState(false);
  const [isProfileLoading, setIsProfileLoading] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(user?.displayName || '');

  React.useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user?.displayName]);

  const handleChangePassword = async () => {
    if (!user?.email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not find your email address.",
      });
      return;
    }

    setIsPasswordLoading(true);
    try {
      await sendPasswordReset(user.email);
      toast({
        title: "Password Reset Email Sent",
        description: "Please check your inbox for instructions to reset your password.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Send Email",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileLoading(true);
    try {
      await updateUserProfile({ displayName });
      toast({
        title: "Profile Updated",
        description: "Your display name has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsProfileLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
        <CardDescription>Manage your personal information and password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleProfileUpdate} className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <div className="flex gap-2">
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
            />
            <Button type="submit" disabled={isProfileLoading || displayName === (user?.displayName || '')}>
              {isProfileLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
        <div className="space-y-2">
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button onClick={handleChangePassword} disabled={isPasswordLoading} variant="outline">
          {isPasswordLoading ? 'Sending...' : 'Send Password Reset Email'}
        </Button>
      </CardFooter>
    </Card>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ... (MyProfileCard component remains the same)

function UserManagementCard() {
  const { user: currentUser, currentOrgRole, currentOrgId, claims } = useAuth();
  const { data: users, isLoading, error } = useUsers();
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser();
  const { toast } = useToast();

  const isCurrentUserOrgOwner = currentOrgRole === 'owner';

  const handleDeleteUser = (userId: string) => {
    deleteUser(userId, {
      onSuccess: () => {
        toast({
          title: "User Deleted",
          description: "The user has been successfully deleted.",
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Deletion Failed",
          description: error.message || "An unexpected error occurred.",
        });
      },
    });
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    // This will call a new mutation to update the user's role
    console.log(`Change role for user ${userId} to ${newRole} in org ${currentOrgId}`);
    toast({
      title: "Role Change (Not Implemented)",
      description: `Attempted to change role for ${userId} to ${newRole}. Backend not yet connected.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage users within your organization.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-8 w-1/5" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-8 w-1/5" />
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">Failed to load users: {error.message}</p>
        )}
        {users && (
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.uid} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{user.displayName || 'No Name'}{currentUser?.uid === user.uid && ' (You)'}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">Role: {claims?.role || 'member'}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {isCurrentUserOrgOwner && currentUser?.uid !== user.uid && (
                    <Select
                      value={claims?.role === 'owner' ? 'org_owner' : claims?.role === 'admin' ? 'org_admin' : claims?.role || 'member'}
                      onValueChange={(newRole) => handleRoleChange(user.uid, newRole)}
                      disabled={isDeleting}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="org_owner">Org Owner</SelectItem>
                        <SelectItem value="org_admin">Org Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={currentUser?.uid === user.uid || isDeleting || !isCurrentUserOrgOwner}
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the user account
                          and all associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteUser(user.uid)}>
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ... (Settings component remains the same)

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">App Settings</h1>
        <p className="text-muted-foreground">Manage your organization, profile, and users.</p>
      </div>

      <RoleGuard scope="global" allowedRoles={['app_owner']}>
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertTitle>App Owner Status Confirmed!</AlertTitle>
          <AlertDescription>
            This message is only visible to users with the global 'app_owner' role.
          </AlertDescription>
        </Alert>
      </RoleGuard>

      <div className="grid gap-6">
        <MyProfileCard />
        <RoleGuard scope="org" allowedRoles={['org_owner', 'org_admin']}>
          <UserManagementCard />
        </RoleGuard>
      </div>
    </div>
  );
}
