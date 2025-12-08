import React, { useState } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, Plus, User, Building } from 'lucide-react';
import { useAllOrgs } from '@/hooks/useAllOrgs';
import { OrgEntitlementsDialog } from '@/components/OrgEntitlementsDialog';
import { OrgUsersDialog } from '@/components/OrgUsersDialog';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orgOperations, entitlementOperations, userOperations, employeeOperations, User as FirestoreUser } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

function OrganizationsTab() {
  const { data: orgs, isLoading, error } = useAllOrgs();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setIsCreating(true);
    try {
      const orgId = await orgOperations.create({
        name: newOrgName,
        plan: 'free',
        region: 'US',
        defaultUnits: 'imperial'
      });

      await entitlementOperations.create(orgId, {
        plan: 'free',
        features: {
          'capture.ar': true,
          'capture.reference': true,
          'capture.weeklyLimit': 5,
          'visual.recolor': true,
          'visual.sheenSimulator': false,
          'portal.fullView': true,
          'portal.advancedActionsLocked': true,
          'analytics.lite': true,
          'analytics.drilldowns': false,
          'pdf.watermark': true,
          eSign: false,
          payments: false,
          scheduler: false,
          'quote.tiers': false,
          'quote.profitMargin': false,
          'quote.visualScope': false,
          'client.importCSV': false,
        }
      });

      toast({
        title: "Organization Created",
        description: `${newOrgName} has been successfully created with default entitlements.`,
      });

      setNewOrgName("");
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['allOrgs'] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create organization.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('admin_page.orgs.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin_page.orgs.description')}</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Add a new organization to the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateOrg} disabled={isCreating || !newOrgName.trim()}>
                {isCreating ? "Creating..." : "Create Organization"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
          {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>}

          {orgs && orgs.length > 0 && (
            <div className="space-y-4">
              {orgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{t('admin_page.orgs.plan')}: {org.plan}</p>
                  </div>
                  <div className="flex gap-2">
                    <OrgUsersDialog orgId={org.id} orgName={org.name}>
                      <Button variant="outline" size="sm">{t('admin_page.orgs.users')}</Button>
                    </OrgUsersDialog>
                    <OrgEntitlementsDialog orgId={org.id} orgName={org.name}>
                      <Button variant="outline" size="sm">{t('admin_page.orgs.manage')}</Button>
                    </OrgEntitlementsDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => userOperations.getAll(),
  });
  const { data: orgs } = useAllOrgs();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<(FirestoreUser & { id: string }) | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const handleAssignOrg = async () => {
    if (!selectedUser || !selectedOrgId) return;

    try {
      // 1. Create Employee Record
      // We don't have the user's name if they registered via email only, so default to email or "New User"
      const employeeName = selectedUser.email.split('@')[0] || "New Employee";

      await employeeOperations.create({
        orgId: selectedOrgId,
        name: employeeName,
        email: selectedUser.email,
        role: 'painter', // Default role
      });

      // 2. Update the User doc with the new orgId and role map
      const currentOrgIds = selectedUser.orgIds || [];
      const currentRoles = selectedUser.roles || {};

      const updates: any = {};
      if (!currentOrgIds.includes(selectedOrgId)) {
        updates.orgIds = [...currentOrgIds, selectedOrgId];
      }
      // Always update the role map for this org
      updates.roles = { ...currentRoles, [selectedOrgId]: 'painter' };

      if (Object.keys(updates).length > 0) {
        await userOperations.update(selectedUser.id, updates);
      }

      // Invalidate queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });

      toast({ title: "User Assigned", description: `Assigned ${selectedUser.email} to organization.` });
      setIsAssignOpen(false);
      setSelectedOrgId("");
      setSelectedUser(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Assignment Failed", description: error.message });
    }
  };

  const handleOpenAssign = async (user: FirestoreUser & { id: string }) => {
    setSelectedUser(user);
    // Default to the first org if they belong to one
    if (user.orgIds && user.orgIds.length > 0) {
      setSelectedOrgId(user.orgIds[0]);
    } else {
      // Fallback: Check if they are already an employee somewhere (legacy data)
      try {
        const employees = await employeeOperations.getByEmail(user.email);
        if (employees.length > 0) {
          const foundOrgId = employees[0].orgId;
          setSelectedOrgId(foundOrgId);

          // Self-heal: Update the user doc
          const role = employees[0].role as string;
          await userOperations.update(user.id, {
            orgIds: [foundOrgId],
            roles: { [foundOrgId]: role }
          });
          queryClient.invalidateQueries({ queryKey: ['allUsers'] });
          toast({ title: "User Data Synced", description: "Found existing organization membership." });
        } else {
          setSelectedOrgId("");
        }
      } catch (e) {
        console.error(e);
        setSelectedOrgId("");
      }
    }
    setIsAssignOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      try {
        const { deleteDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        await deleteDoc(doc(db, 'users', userId));
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        toast({ title: "User Deleted" });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: error.message });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Platform Users</h2>
        <p className="text-sm text-muted-foreground">Manage registered users and assign them to organizations.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <div>Loading users...</div>}
          <div className="space-y-4">
            {users?.map(user => (
              <div key={user.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {user.email}
                    {user.id === currentUser?.uid && (
                      <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-semibold">YOU</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">ID: {user.id}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {user.globalRole && <span className="mr-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md">Global: {user.globalRole}</span>}
                    {user.orgIds && user.orgIds.length > 0 && <span className="mr-2">Orgs: {user.orgIds.length}</span>}
                    {/* Helper to show role for default org if only 1 */}
                    {user.roles && user.orgIds && user.orgIds.length === 1 && (
                      <span>Role: {user.roles[user.orgIds[0]]}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog open={isAssignOpen} onOpenChange={(open) => {
                    setIsAssignOpen(open);
                    if (!open) {
                      setSelectedUser(null);
                      setSelectedOrgId("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleOpenAssign(user)}>Assign to Org</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign User to Organization</DialogTitle>
                        <DialogDescription>
                          Add {selectedUser?.email} to an organization.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Label>Select Organization</Label>
                        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an org..." />
                          </SelectTrigger>
                          <SelectContent>
                            {orgs?.map(org => (
                              <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAssignOrg} disabled={!selectedOrgId}>Confirm Assignment</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteUser(user.id)}>
                    <h2 className="sr-only">Delete</h2>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  return (
    <RoleGuard
      scope="global"
      allowedRoles={['owner', 'admin', 'platform_owner']}
      fallback={
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t('admin_page.access_denied.title')}</AlertTitle>
          <AlertDescription>
            {t('admin_page.access_denied.description')}
          </AlertDescription>
        </Alert>
      }
    >
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{t('admin_page.title')}</h1>
          <p className="text-muted-foreground">{t('admin_page.subtitle')}</p>
        </div>

        <Tabs defaultValue="orgs" className="w-full">
          <TabsList>
            <TabsTrigger value="orgs" className="flex items-center gap-2">
              <Building className="h-4 w-4" /> Organizations
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <User className="h-4 w-4" /> Users
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="orgs">
              <OrganizationsTab />
            </TabsContent>
            <TabsContent value="users">
              <UsersTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
