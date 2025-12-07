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
import { entitlementOperations, ALL_BOOLEAN_FEATURES } from '@/lib/firestore';

interface OrgEntitlementsDialogProps {
  orgId: string;
  orgName: string;
  children: React.ReactNode;
}

import { useTranslation } from 'react-i18next';

export function OrgEntitlementsDialog({ orgId, orgName, children }: OrgEntitlementsDialogProps) {
  const { t } = useTranslation();
  const { entitlements, plan, hasFeature, isLoading, refetch } = useEntitlements(orgId);
  const { mutate: updateEntitlements, isPending } = useUpdateEntitlements();
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = React.useState(false);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
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

        }
      });
      toast({
        title: "Initialized",
        description: "Default entitlements have been created.",
      });
      refetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsInitializing(false);
    }
  };

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
            Current plan: <span className="font-bold capitalize">{plan || 'Unknown'}</span>. Toggle features for this organization.
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
            <div className="text-center py-4 space-y-4">
              <p className="text-muted-foreground">No entitlements found for this organization.</p>
              <Button onClick={handleInitialize} disabled={isInitializing}>
                {isInitializing ? "Initializing..." : "Initialize Defaults"}
              </Button>
            </div>
          )}
          {!isLoading && entitlements && (
            <div className="space-y-4">
              {ALL_BOOLEAN_FEATURES.sort().map((key) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor={key} className="text-base">
                      {t(`admin_page.features.${key}`, { defaultValue: key })}
                    </Label>
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
