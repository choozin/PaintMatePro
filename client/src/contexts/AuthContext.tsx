import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signIn as authSignIn, signOut as authSignOut, getUserClaims } from '@/lib/firebaseAuth';
import { getDocById } from '@/lib/firestore';
import { OrgSetup } from '@/components/OrgSetup';
import type { Org, Entitlement } from '@/lib/firestore';

interface UserClaims {
  orgIds: string[];
  role: string;
}

interface AuthContextType {
  user: User | null;
  claims: UserClaims | null;
  org: Org | null;
  entitlements: Entitlement | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<UserClaims | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  // Load org and entitlements when user/claims change
  useEffect(() => {
    async function loadOrgData() {
      if (!user || !claims || claims.orgIds.length === 0) {
        setOrg(null);
        setEntitlements(null);
        return;
      }

      try {
        // Get the first org (users belong to exactly one org according to rules)
        const orgId = claims.orgIds[0];
        const [orgData, entData] = await Promise.all([
          getDocById<Org>('orgs', orgId),
          getDocById<Entitlement>('entitlements', orgId),
        ]);

        setOrg(orgData);
        setEntitlements(entData);
      } catch (error) {
        console.error('Error loading org data:', error);
      }
    }

    loadOrgData();
  }, [user, claims]);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userClaims = await getUserClaims();
        setClaims(userClaims);
      } else {
        setClaims(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await authSignIn(email, password);
    // User state will be updated by the onAuthChange listener
  };

  const signOut = async () => {
    await authSignOut();
    // User state will be updated by the onAuthChange listener
  };

  const value = {
    user,
    claims,
    org,
    entitlements,
    loading,
    signIn,
    signOut,
  };

  // Show org setup screen if user is logged in but has no orgIds
  if (!loading && user && claims && claims.orgIds.length === 0) {
    return <OrgSetup onOrgIdSet={() => window.location.reload()} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
