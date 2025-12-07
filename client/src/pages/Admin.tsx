import React from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert } from 'lucide-react';
import { useAllOrgs } from '@/hooks/useAllOrgs';
import { OrgEntitlementsDialog } from '@/components/OrgEntitlementsDialog';
import { OrgUsersDialog } from '@/components/OrgUsersDialog';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { orgOperations, entitlementOperations } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function AdminPanel() {
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

      // Create default entitlements
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{t('admin_page.title')}</h1>
          <p className="text-muted-foreground">{t('admin_page.subtitle')}</p>
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
                Add a new organization to the platform. You can manage users and entitlements after creation.
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
        <CardHeader>
          <CardTitle>{t('admin_page.orgs.title')}</CardTitle>
          <CardDescription>{t('admin_page.orgs.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>Failed to load organizations: {error.message}</AlertDescription>
            </Alert>
          )}
          {orgs && orgs.length === 0 && (
            <p className="text-muted-foreground">{t('admin_page.orgs.no_orgs')}</p>
          )}
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

export default function AdminPage() {
  const { t } = useTranslation();
  return (
    <RoleGuard
      scope="global"
      allowedRoles={['owner', 'admin']}
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
      <AdminPanel />
    </RoleGuard>
  );
}
