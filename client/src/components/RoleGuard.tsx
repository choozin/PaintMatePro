import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  scope?: 'global' | 'org'; // New prop to specify role scope
}

export function RoleGuard({ allowedRoles, children, fallback = null, scope = 'org' }: RoleGuardProps) {
  const { claims, currentOrgRole, loading } = useAuth();

  if (loading) {
    // You might want to show a loading spinner here
    return null;
  }

  let userRole: string | null = null;
  if (scope === 'global') {
    userRole = claims?.role || null;
  } else { // scope === 'org'
    userRole = currentOrgRole;
  }

  if (userRole && allowedRoles.includes(userRole)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
