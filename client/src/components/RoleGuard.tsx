import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OrgRole, GlobalRole, Permission, hasPermission } from '@/lib/permissions';

interface RoleGuardProps {
  allowedRoles?: (OrgRole | GlobalRole | string)[];
  permission?: Permission;
  children: React.ReactNode; // Corrected type
  fallback?: React.ReactNode;
  scope?: 'global' | 'org';
}

export function RoleGuard({ allowedRoles, permission, children, fallback = null, scope = 'org' }: RoleGuardProps) {
  const { claims, currentOrgRole, currentPermissions, loading } = useAuth(); // Destructure currentPermissions

  if (loading) {
    return null; // Or spinner
  }

  // 1. Permission Check (Preferred for Org Scope)
  if (permission && scope === 'org') {
    // Pass the permissions array to the helper
    if (hasPermission(currentPermissions, permission)) {
      return <>{children}</>;
    }
  }

  // 2. Role Check (Legacy/Specific/Global)
  if (allowedRoles) {
    let userRole: string | null = null;
    if (scope === 'global') {
      userRole = claims?.globalRole || claims?.role || null; // Check global role first
    } else { // scope === 'org'
      userRole = currentOrgRole;
    }

    if (userRole && allowedRoles.includes(userRole)) {
      return <>{children}</>;
    }
  }

  return <>{fallback}</>;
}
