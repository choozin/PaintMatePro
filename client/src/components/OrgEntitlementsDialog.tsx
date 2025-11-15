import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useUpdateEntitlements } from '@/hooks/useUpdateEntitlements';
import { useToast } from '@/hooks/use-toast';

interface OrgEntitlementsDialogProps {
  orgId: string;
  orgName: string;
  children: React.ReactNode;
}

export function OrgEntitlementsDialog({ orgId, orgName, children }: OrgEntitlementsDialogProps) {
  const { entitlements, plan, hasFeature, isLoading } = useEntitlements(orgId);
  const { mutate: updateEntitlements, isPending } = useUpdateEntitlements();
  const { toast } = useToast();

  const handleFeatureToggle = (featureKey: string, value: boolean) => {
    updateEntitlements({ orgId, featureKey, value }, {
      onSuccess: () => {
        toast({
          title: "Features Updated",
          description: `'${featureKey}' has been ${value ? 'enabled' : 'disabled'} for ${orgName}.`,
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: error.message,
        });
      },
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Entitlements for {orgName}</DialogTitle>
          <DialogDescription>
            Current plan: <span className="font-bold capitalize">{plan}</span>. Toggle features for this organization.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!isLoading && !entitlements && (
            <p className="text-muted-foreground">No entitlements found for this organization.</p>
          )}
          {!isLoading && entitlements && (
            <div className="space-y-4">
              {Object.keys(entitlements.features).sort().map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor={key} className="text-base">{key}</Label>
                    <p className="text-sm text-muted-foreground">
                      {hasFeature(key) ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <Switch
                    id={key}
                    checked={hasFeature(key)}
                    onCheckedChange={(checked) => handleFeatureToggle(key, checked)}
                    disabled={isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
