import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  onAuthChange, 
  signIn as authSignIn, 
  signOut as authSignOut, 
  sendPasswordReset as authSendPasswordReset,
  updateUserProfile as authUpdateUserProfile,
  getUserClaims as getAuthClaims
} from '@/lib/firebaseAuth';
import { getDocById } from '@/lib/firestore';
import type { Org, Entitlement, OrgWithId } from '@/lib/firestore';

// Define the full context type
export interface UserClaims {
  orgIds: string[];
  role: 'owner' | 'admin' | 'member';
}

interface AuthContextType {
  user: User | null;
  claims: UserClaims | null;
  currentOrgId: string | null;
  currentOrgRole: 'owner' | 'admin' | 'member' | null;
  org: OrgWithId | null;
  entitlements: Entitlement | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateUserProfile: (profile: { displayName?: string }) => Promise<void>;
  refetchEntitlements: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider with full logic
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrgRole, setCurrentOrgRole] = useState<'owner' | 'admin' | 'member' | null>(null);
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

        const parsedClaims: UserClaims = {
          orgIds: userClaims.orgIds || [],
          role: userClaims.role as UserClaims['role'] || 'member', // Assert type
        };
        setClaims(parsedClaims);

        let firstOrgId = parsedClaims.orgIds[0] || null;
        
        // If no orgs in claims, check for a fallback in localStorage
        if (!firstOrgId) {
          const fallbackOrgId = localStorage.getItem('fallbackOrgId');
          if (fallbackOrgId) {
            console.log(`Using fallback orgId from localStorage: ${fallbackOrgId}`);
            firstOrgId = fallbackOrgId;
            // Add fallbackOrgId to orgIds if it's not already there
            if (!parsedClaims.orgIds.includes(fallbackOrgId)) {
              parsedClaims.orgIds.push(fallbackOrgId);
            }
          }
        }

        setCurrentOrgId(firstOrgId);
        // The role is now a single string, not per-org.
        setCurrentOrgRole(parsedClaims.role); 
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
    signOut,
    sendPasswordReset,
    updateUserProfile,
    refetchEntitlements,
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