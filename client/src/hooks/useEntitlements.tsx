import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { entitlementOperations } from '@/lib/firestore';
import type { Entitlement, Org } from '@/lib/firestore';

/**
 * Hook to check if a specific feature is enabled for the current org
 */
export function useEntitlements(targetOrgId?: string) {
  const { entitlements: userEntitlements, org: userOrg, claims } = useAuth();
  const currentOrgId = claims?.orgIds[0];

  // If a targetOrgId is provided, fetch entitlements for that org
  // Otherwise, use the entitlements from the AuthContext (for the current user's org)
  const { data: adminFetchedEntitlements, isLoading: adminEntitlementsLoading, refetch } = useQuery<Entitlement | null, Error>({
    queryKey: ['entitlements', targetOrgId],
    queryFn: () => entitlementOperations.get(targetOrgId!),
    enabled: !!targetOrgId, // Only fetch if targetOrgId is provided
  });

  const entitlements = targetOrgId ? adminFetchedEntitlements : userEntitlements;
  const org = targetOrgId ? null : userOrg; // Org data is not fetched by this hook if targetOrgId is used

  const hasFeature = (featureKey: string): boolean => {
    if (!entitlements) return false;

    // Navigate nested feature keys like "capture.ar"
    const keys = featureKey.split('.');
    let current: any = entitlements.features;

    for (const key of keys) {
      if (current === undefined || current === null) return false;
      current = current[key];
    }

    return Boolean(current);
  };

  const getFeatureValue = <T,>(featureKey: string, defaultValue: T): T => {
    if (!entitlements) return defaultValue;

    const keys = featureKey.split('.');
    let current: any = entitlements.features;

    for (const key of keys) {
      if (current === undefined || current === null) return defaultValue;
      current = current[key];
    }

    return current !== undefined ? current : defaultValue;
  };

  const isPlanType = (planType: 'free' | 'pro' | 'enterprise'): boolean => {
    // If targetOrgId is provided, we don't have the org object here, so we can't check plan type
    if (targetOrgId) return false;
    return org?.plan === planType;
  };

  return {
    entitlements,
    plan: org?.plan || 'free', // This will be 'free' if targetOrgId is provided
    hasFeature,
    getFeatureValue,
    isPlanType,
    isFreePlan: isPlanType('free'),
    isProPlan: isPlanType('pro'),
    isEnterprisePlan: isPlanType('enterprise'),
    isLoading: targetOrgId ? adminEntitlementsLoading : false, // Only show loading for admin-fetched entitlements
    refetch,
  };
}
