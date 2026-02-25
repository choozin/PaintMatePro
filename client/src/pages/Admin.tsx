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
import { createOrgWithOwner, deleteOrgDeep, unassignUser, deleteUserDataWipe, changeOrgOwner } from "@/lib/adminOperations"; // Import new ops
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

function OrganizationsTab() {
  const { data: orgs, isLoading, error } = useAllOrgs();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !ownerEmail.trim() || !ownerPassword.trim()) return;
    setIsCreating(true);
    try {
      await createOrgWithOwner(newOrgName, ownerEmail, ownerPassword);

      toast({
        title: "Organization Created",
        description: `${newOrgName} created with owner ${ownerEmail}.`,
      });

      setNewOrgName("");
      setOwnerEmail("");
      setOwnerPassword("");
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

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (confirm(`Are you sure you want to PERMANENTLY DELETE ${orgName}? This will wipe ALL data for this organization including projects, clients, and quotes. This cannot be undone.`)) {
      try {
        await deleteOrgDeep(orgId);
        queryClient.invalidateQueries({ queryKey: ['allOrgs'] });
        toast({ title: "Organization Deleted", description: "All data has been wiped." });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: error.message });
      }
    }
  };

  const [isChangeOwnerOpen, setIsChangeOwnerOpen] = useState(false);
  const [selectedOrgForOwnerChange, setSelectedOrgForOwnerChange] = useState<{ id: string, name: string } | null>(null);
  const [newOwnerId, setNewOwnerId] = useState("");

  // Fetch users for the selected org when dialog opens efficiently? 
  // For now, let's just fetch ALL users and filter in UI or let user search by email.
  // Better: Use a dedicated component or just reuse UsersTab logic? 
  // Let's keep it simple: Select from list of ALL users in the system (since new owner might not be in org yet).
  const { data: allUsers } = useQuery({ queryKey: ['allUsers'], queryFn: () => userOperations.getAll() });

  const handleChangeOwner = async () => {
    if (!selectedOrgForOwnerChange || !newOwnerId) return;

    if (confirm(`Are you sure you want to transfer ownership of ${selectedOrgForOwnerChange.name} to the selected user? The current owner will be demoted to Admin.`)) {
      try {
        await changeOrgOwner(selectedOrgForOwnerChange.id, newOwnerId);
        toast({ title: "Ownership Transferred", description: `New owner assigned for ${selectedOrgForOwnerChange.name}.` });
        setIsChangeOwnerOpen(false);
        setSelectedOrgForOwnerChange(null);
        setNewOwnerId("");
        queryClient.invalidateQueries({ queryKey: ['allOrgs'] });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Transfer Failed", description: error.message });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('admin_page.orgs.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin_page.orgs.description')}</p>
        </div>
        {/* ... Create Org Dialog ... */}
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
                Create a new organization and its primary owner account.
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
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner Email</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerPassword">Owner Password</Label>
                <Input
                  id="ownerPassword"
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateOrg} disabled={isCreating || !newOrgName.trim() || !ownerEmail.trim() || !ownerPassword.trim()}>
                {isCreating ? "Creating..." : "Create Organization"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Owner Dialog */}
        <Dialog open={isChangeOwnerOpen} onOpenChange={(open) => {
          setIsChangeOwnerOpen(open);
          if (!open) { setSelectedOrgForOwnerChange(null); setNewOwnerId(""); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Organization Owner</DialogTitle>
              <DialogDescription>
                Select a new owner for <strong>{selectedOrgForOwnerChange?.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Select New Owner</Label>
                <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Search users..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {allUsers
                      ?.filter(user => user.orgIds?.includes(selectedOrgForOwnerChange?.id || ''))
                      .map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                          {user.roles?.[selectedOrgForOwnerChange?.id || ''] === 'org_owner' ? ' (Current)' : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The selected user will become the new Owner. The current owner(s) will be demoted to Admin.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsChangeOwnerOpen(false)}>Cancel</Button>
              <Button onClick={handleChangeOwner} disabled={!newOwnerId}>Confirm Transfer</Button>
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
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedOrgForOwnerChange({ id: org.id, name: org.name });
                      setIsChangeOwnerOpen(true);
                    }}>
                      Change Owner
                    </Button>
                    <OrgUsersDialog orgId={org.id} orgName={org.name}>
                      <Button variant="outline" size="sm">{t('admin_page.orgs.users')}</Button>
                    </OrgUsersDialog>
                    <OrgEntitlementsDialog orgId={org.id} orgName={org.name}>
                      <Button variant="outline" size="sm">Entitlements</Button>
                    </OrgEntitlementsDialog>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteOrg(org.id, org.name)}>
                      <ShieldAlert className="h-4 w-4" />
                    </Button>
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
  const [selectedRole, setSelectedRole] = useState("painter");
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
        role: 'painter', // Default role - will be updated by role map below conceptually, but stored in employee record for redundancy/offline logic
      });

      // 2. Update the User doc with the new orgId and role map
      const currentOrgIds = selectedUser.orgIds || [];
      const currentRoles = selectedUser.roles || {};

      const updates: any = {};
      if (!currentOrgIds.includes(selectedOrgId)) {
        updates.orgIds = [...currentOrgIds, selectedOrgId];
      }
      // Always update the role map for this org
      updates.roles = { ...currentRoles, [selectedOrgId]: selectedRole };

      if (Object.keys(updates).length > 0) {
        await userOperations.update(selectedUser.id, updates);
      }

      // Invalidate queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });

      toast({ title: "User Assigned", description: `Assigned ${selectedUser.email} to organization as ${selectedRole}.` });
      setIsAssignOpen(false);
      setSelectedOrgId("");
      setSelectedRole("painter");
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

  const handleUnassign = async (userId: string, orgId: string) => {
    if (confirm("Are you sure you want to unassign this user from this organization? They will lose access to the org but their account will remain.")) {
      try {
        await unassignUser(userId, orgId);
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        toast({ title: "User Unassigned" });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Unassign Failed", description: error.message });
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Are you sure you want to PERMANENTLY DELETE this user? This will wipe their data from the database. Note: The Auth account will still exist (Firebase limitation).")) {
      try {
        await deleteUserDataWipe(userId);
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        toast({ title: "User Data Wiped" });
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

                    {/* Display Org Chips with Unassign Option */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.orgIds?.map(orgId => {
                        const orgName = orgs?.find(o => o.id === orgId)?.name || 'Unknown Org';
                        const role = user.roles?.[orgId] || 'N/A';
                        return (
                          <span key={orgId} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px]">
                            {orgName} ({role})
                            <button
                              onClick={() => handleUnassign(user.id, orgId)}
                              className="hover:text-destructive transition-colors"
                              title="Unassign from Org"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <Dialog open={isAssignOpen} onOpenChange={(open) => {
                    setIsAssignOpen(open);
                    if (!open) {
                      setSelectedUser(null);
                      setSelectedOrgId("");
                      setSelectedRole("painter");
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
                      <div className="pb-4">
                        <Label>Select Role</Label>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="org_owner">Owner</SelectItem>
                            <SelectItem value="org_admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="estimator">Estimator</SelectItem>
                            <SelectItem value="foreman">Foreman</SelectItem>
                            <SelectItem value="painter">Painter</SelectItem>
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

// ... Imports
import { roleTemplateOperations, RoleTemplate } from "@/lib/firestore";
import { RoleEditorDialog } from "@/components/dialogs/RoleEditorDialog";
import { Badge } from "@/components/ui/badge";
import { Permission, getLegacyFallbackPermissions } from '@/lib/permissions';

function RoleTemplatesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | undefined>(undefined);
  const [templateToDelete, setTemplateToDelete] = useState<RoleTemplate | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['roleTemplates'],
    queryFn: () => roleTemplateOperations.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; permissions: Permission[] }) =>
      roleTemplateOperations.create({
        name: data.name,
        description: data.description,
        defaultPermissions: data.permissions,
        isSystemDefault: false
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleTemplates'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; description: string; permissions: Permission[] }) =>
      roleTemplateOperations.update(data.id, { name: data.name, description: data.description, defaultPermissions: data.permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleTemplates'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roleTemplateOperations.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleTemplates'] });
      toast({ title: "Template Deleted" });
      setTemplateToDelete(null);
    }
  });

  const handleSeedDefaults = async () => {
    try {
      const defaults = ['org_owner', 'org_admin', 'manager', 'estimator', 'foreman', 'painter'];
      await Promise.all(defaults.map(roleKey => {
        const formattedName = roleKey.replace('org_', '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const finalName = roleKey === 'org_owner' ? 'Owner' : (roleKey === 'org_admin' ? 'Admin' : formattedName);

        return roleTemplateOperations.create({
          name: finalName,
          description: `Default template for ${finalName}`,
          defaultPermissions: getLegacyFallbackPermissions(roleKey),
          isSystemDefault: true
        });
      }));
      queryClient.invalidateQueries({ queryKey: ['roleTemplates'] });
      toast({ title: "System Defaults Seeded" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSave = async (data: { name: string; description: string; permissions: Permission[] }) => {
    if (dialogMode === 'create') {
      await createMutation.mutateAsync(data);
    } else if (selectedTemplate) {
      await updateMutation.mutateAsync({ id: selectedTemplate.id, ...data });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Role Templates</h2>
          <p className="text-sm text-muted-foreground">Manage global role templates that organizations can inherit.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDefaults}>Seed Defaults</Button>
          <Button onClick={() => { setDialogMode('create'); setSelectedTemplate(undefined); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <div>Loading...</div>}
          <div className="space-y-4">
            {templates?.map(template => (
              <div key={template.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {template.name}
                    {template.isSystemDefault && <Badge variant="secondary">System</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setDialogMode('edit');
                    setSelectedTemplate(template);
                    setIsDialogOpen(true);
                  }}>
                    Edit
                  </Button>
                  {!template.isSystemDefault && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setTemplateToDelete(template)}>
                      <ShieldAlert className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {templates?.length === 0 && <div className="text-center py-8 text-muted-foreground">No templates found.</div>}
          </div>
        </CardContent>
      </Card>

      <RoleEditorDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        mode={dialogMode}
        initialData={selectedTemplate ? { name: selectedTemplate.name, description: selectedTemplate.description || '', permissions: selectedTemplate.defaultPermissions } : undefined}
        onSave={handleSave}
      />

      <Dialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>Permanently delete <strong>{templateToDelete?.name}</strong>?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTemplateToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => templateToDelete && deleteMutation.mutate(templateToDelete.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ... existing AdminPage ...

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
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Role Templates
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="orgs">
              <OrganizationsTab />
            </TabsContent>
            <TabsContent value="users">
              <UsersTab />
            </TabsContent>
            <TabsContent value="roles">
              <RoleTemplatesTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </RoleGuard>
  );
}

