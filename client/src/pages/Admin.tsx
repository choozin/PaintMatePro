import React from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert } from 'lucide-react';
import { useAllOrgs } from '@/hooks/useAllOrgs';
import { OrgEntitlementsDialog } from '@/components/OrgEntitlementsDialog';

function AdminPanel() {
  const { data: orgs, isLoading, error } = useAllOrgs();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">App Administration</h1>
        <p className="text-muted-foreground">Manage all organizations and app-level settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>View and manage entitlements for all organizations.</CardDescription>
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
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Failed to load organizations: {error.message}</AlertDescription>
            </Alert>
          )}
          {orgs && orgs.length === 0 && (
            <p className="text-muted-foreground">No organizations found.</p>
          )}
          {orgs && orgs.length > 0 && (
            <div className="space-y-4">
              {orgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">Plan: {org.plan}</p>
                  </div>
                  <OrgEntitlementsDialog orgId={org.id} orgName={org.name}>
                    <Button variant="outline" size="sm">Manage</Button>
                  </OrgEntitlementsDialog>
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
  return (
    <RoleGuard 
      scope="global"
      allowedRoles={['owner', 'admin']}
      fallback={
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      }
    >
      <AdminPanel />
    </RoleGuard>
  );
}
