import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  onAuthChange,
  signIn as authSignIn,
  signOut as authSignOut,
  sendPasswordReset as authSendPasswordReset,
  updateUserProfile as authUpdateUserProfile,
  getUserClaims as getAuthClaims,
  registerUser as authRegisterUser
} from '@/lib/firebaseAuth';
import { getDocById } from '@/lib/firestore';
import type { Org, Entitlement, OrgWithId } from '@/lib/firestore';

import { OrgRole, normalizeRole, GlobalRole } from '@/lib/permissions';

// Define the full context type
export interface UserClaims {
  orgIds: string[];
  role: OrgRole | string;
  globalRole?: string;
  rolesMap?: Record<string, string>;
}

interface AuthContextType {
  user: User | null;
  claims: UserClaims | null;
  currentOrgId: string | null;
  currentOrgRole: OrgRole | string | null;
  org: OrgWithId | null;
  entitlements: Entitlement | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, orgName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateUserProfile: (profile: { displayName?: string }) => Promise<void>;
  refetchEntitlements: () => Promise<void>;
  setCurrentOrgId: (id: string) => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider with full logic
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrgRole, setCurrentOrgRole] = useState<OrgRole | string | null>(null);
  const [org, setOrg] = useState<OrgWithId | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrgData = useCallback(async () => {
    if (!user || !currentOrgId) {
      setOrg(null);
      setEntitlements(null);
      return;
    }
    try {
      const [orgData, entData] = await Promise.all([
        getDocById<Org>('orgs', currentOrgId),
        getDocById<Entitlement>('entitlements', currentOrgId),
      ]);
      setOrg(orgData);
      setEntitlements(entData);
    } catch (error) {
      console.error('Error loading org data:', error);
    }
  }, [user, currentOrgId]);

  // Update currentOrgRole when org changes or claims update
  useEffect(() => {
    if (claims && currentOrgId) {
      // Priority 1: Check rolesMap from DB
      if (claims.rolesMap && claims.rolesMap[currentOrgId]) {
        const role = claims.rolesMap[currentOrgId];
        setCurrentOrgRole(normalizeRole(role));
        return;
      }
      // Priority 2: Check if global admin
      if (claims.globalRole === 'platform_owner') {
        setCurrentOrgRole('org_owner');
        return;
      }
      // Priority 3: Fallback to token role
      setCurrentOrgRole(normalizeRole(claims.role as string));
    } else {
      setCurrentOrgRole(null);
    }
  }, [user, currentOrgId, claims]);

  useEffect(() => {
    loadOrgData();
  }, [loadOrgData]);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userClaims = await getAuthClaims();
        console.log('🔑 Custom claims loaded:', userClaims);

        if (!userClaims) {
          setClaims(null);
          setCurrentOrgId(null);
          setCurrentOrgRole(null);
          setLoading(false);
          return;
        }

        const globalRole = userClaims.globalRole;
        const parsedClaims: UserClaims = {
          orgIds: userClaims.orgIds || [],
          role: userClaims.role as OrgRole || 'painter',
          globalRole: globalRole,
          rolesMap: userClaims.rolesMap
        };
        setClaims(parsedClaims);

        // Determine Initial Org ID
        let targetOrgId: string | null = null;
        const savedOrgId = localStorage.getItem('fallbackOrgId');

        if (savedOrgId) {
          // Priority 1: Explicitly selected org from storage
          targetOrgId = savedOrgId;
          console.log(`Using selected orgId: ${targetOrgId}`);
        } else {
          // Priority 2: Auto-select only if unambiguous
          const isGlobalAdmin = globalRole === 'platform_owner' || globalRole === 'platform_admin';
          const isMultiOrg = parsedClaims.orgIds.length > 1;

          if (!isGlobalAdmin && !isMultiOrg && parsedClaims.orgIds.length === 1) {
            targetOrgId = parsedClaims.orgIds[0];
          }
          // If Global Admin or Multi-Org and no saved selection -> Remain null to trigger selection screen
        }

        // Add savedOrgId to orgIds if valid and missing (fallback for direct linking)
        if (savedOrgId && !parsedClaims.orgIds.includes(savedOrgId)) {
          // For global admins they might select an org not in their token claims
          // We allow this temporarily so the context can load that org's data
          parsedClaims.orgIds.push(savedOrgId);
        }

        setCurrentOrgId(targetOrgId);
        setClaims(parsedClaims); // Update claims again if fallback modified orgIds

      } else {
        setClaims(null);
        setCurrentOrgId(null);
        setCurrentOrgRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await authSignIn(email, password);
  };

  const register = async (email: string, password: string, orgName?: string) => {
    const cred = await authRegisterUser(email, password, orgName);

    // Force immediate refresh of claims/profile now that DB is fully populated
    // Force immediate refresh of claims/profile now that DB is fully populated
    // This fixes the race condition where onAuthStateChanged fired before DB updates
    const freshClaims = await getAuthClaims(cred.user);
    setClaims(freshClaims);

    if (freshClaims?.orgIds && freshClaims.orgIds.length > 0) {
      setCurrentOrgId(freshClaims.orgIds[0]);
    }

    await loadOrgData();
  };

  const signOut = async () => {
    await authSignOut();
  };

  const sendPasswordReset = async (email: string) => {
    await authSendPasswordReset(email);
  };

  const updateUserProfile = async (profile: { displayName?: string }) => {
    await authUpdateUserProfile(profile);
    if (auth.currentUser) {
      setUser({ ...auth.currentUser });
    }
  };

  const refetchEntitlements = async () => {
    await loadOrgData();
  };

  const value = {
    user,
    claims,
    currentOrgId,
    currentOrgRole,
    org,
    entitlements,
    loading,
    signIn,
    register,
    signOut,
    sendPasswordReset,
    updateUserProfile,
    refetchEntitlements,
    setCurrentOrgId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Export the useAuth hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}