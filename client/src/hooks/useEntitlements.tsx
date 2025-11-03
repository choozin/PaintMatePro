import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to check if a specific feature is enabled for the current org
 */
export function useEntitlements() {
  const { entitlements, org } = useAuth();

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
    return org?.plan === planType;
  };

  return {
    entitlements,
    plan: org?.plan || 'free',
    hasFeature,
    getFeatureValue,
    isPlanType,
    isFreePlan: isPlanType('free'),
    isProPlan: isPlanType('pro'),
    isEnterprisePlan: isPlanType('enterprise'),
  };
}
