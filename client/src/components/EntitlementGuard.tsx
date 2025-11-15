import React from 'react';
import { useEntitlements } from '@/hooks/useEntitlements';

interface EntitlementGuardProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function EntitlementGuard({ feature, children, fallback = null }: EntitlementGuardProps) {
  const { hasFeature } = useEntitlements();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
