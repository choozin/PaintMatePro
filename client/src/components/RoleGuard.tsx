import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OrgRole, GlobalRole, Permission, hasPermission } from '@/lib/permissions';

interface RoleGuardProps {
  allowedRoles?: (OrgRole | GlobalRole | string)[];
  permission?: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  scope?: 'global' | 'org';
}

export function RoleGuard({ allowedRoles, permission, children, fallback = null, scope = 'org' }: RoleGuardProps) {
  const { claims, currentOrgRole, loading } = useAuth();

  if (loading) {
    return null; // Or spinner
  }

  // 1. Permission Check (Preferred)
  if (permission && scope === 'org') {
    if (hasPermission(currentOrgRole as OrgRole, permission)) {
      return <>{children}</>;
    }
  }

  // 2. Role Check (Legacy/Specific)
  if (allowedRoles) {
    let userRole: string | null = null;
    if (scope === 'global') {
      userRole = claims?.role || null;
    } else { // scope === 'org'
      userRole = currentOrgRole;
    }

    if (userRole && allowedRoles.includes(userRole)) {
      return <>{children}</>;
    }
  }

  return <>{fallback}</>;
}
