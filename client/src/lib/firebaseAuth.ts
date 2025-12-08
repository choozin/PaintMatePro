import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile, // Added for profile updates
  User,
  UserCredential,
} from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { auth } from './firebase';

import { OrgRole } from '@/lib/permissions';

export interface AuthUser extends User {
  customClaims?: {
    orgIds?: string[];
    role?: OrgRole | string;
  };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<UserCredential> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Force token refresh to get latest custom claims
    await userCredential.user.getIdToken(true);
    // Clear any cached fallback org ID since we now have proper claims
    localStorage.removeItem('fallbackOrgId');
    return userCredential;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
}

/**
 * Register a new user with email and password
 */
export async function registerUser(email: string, password: string, orgName?: string): Promise<UserCredential> {
  try {
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const { orgOperations, employeeOperations, entitlementOperations, userOperations } = await import('./firestore');

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 1. Create User Document
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. If Org Name provided, create Org flow (Owner Registration)
    if (orgName) {
      console.log('[DEBUG] Starting Org Creation Flow for:', orgName);

      // Create Org
      try {
        const orgId = await orgOperations.create({
          name: orgName,
          plan: 'free',
          region: 'US',
          defaultUnits: 'imperial'
        });
        console.log('[DEBUG] Org Created with ID:', orgId);

        // Create Default Entitlements
        console.log('[DEBUG] Creating Entitlements...');
        await entitlementOperations.create(orgId, {
          plan: 'free',
          features: {
            'capture.ar': true,
            'capture.reference': true, // Basic features
            'visual.recolor': true,
            'portal.fullView': true,
            'pdf.watermark': true,
            // Disable advanced features for free plan
            'capture.weeklyLimit': 5,
            'visual.sheenSimulator': false,
            'portal.advancedActionsLocked': true,
            'analytics.lite': true,
            'analytics.drilldowns': false,
            eSign: false,
            payments: false,
            scheduler: false,
            'quote.tiers': false,
            'quote.profitMargin': false,
            'quote.visualScope': false,
            'client.importCSV': false,
          }
        });
        console.log('[DEBUG] Entitlements Created');

        // Create Employee Record (Owner)
        console.log('[DEBUG] Creating Employee Record...');
        await employeeOperations.create({
          id: user.uid, // Use Auth ID for owner employee record for easier lookup
          orgId: orgId,
          name: email.split('@')[0], // Default name
          email: email,
          role: 'org_owner'
        });
        console.log('[DEBUG] Employee Record Created');

        // Create/Set User Doc with Org/Role
        // Use 'set' to ensure document creation if it doesn't exist
        console.log('[DEBUG] Updating User Doc with Permissions...');
        await userOperations.set(user.uid, {
          email: email,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          orgIds: [orgId],
          roles: { [orgId]: 'org_owner' },
          globalRole: 'org_owner'
        });
        console.log('[DEBUG] User Doc Updated - Flow Complete');

      } catch (err) {
        console.error('[DEBUG] FAILED during Org Creation Flow:', err);
        throw err;
      }
    }

    return userCredential;
  } catch (error: any) {
    console.error('Registration error:', error);
    throw new Error(error.message || 'Failed to register');
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
}

/**
 * Send a password reset email to the specified email address.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw new Error(error.message || 'Failed to send password reset email');
  }
}

/**
 * Update the current user's profile.
 */
export async function updateUserProfile(profile: { displayName?: string; photoURL?: string }): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is signed in to update the profile.');
  }

  try {
    await updateProfile(user, profile);
  } catch (error: any) {
    console.error('Profile update error:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
}

/**
 * Get the current user's custom claims (orgIds, role)
 */
export async function getUserClaims(): Promise<{ orgIds: string[]; role: OrgRole | string; globalRole?: string; rolesMap?: Record<string, string> } | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const idTokenResult = await user.getIdTokenResult();
    let orgIds = (idTokenResult.claims.orgIds as string[]) || [];
    let rolesMap: Record<string, string> = {}; // Store org-specific roles found in DB

    // Fallback: if no custom claims, try to read from User Profile
    // OR if globalRole is missing, check DB to ensure we respect admin status
    let globalRole = (idTokenResult.claims.globalRole as string) || undefined;

    // If we don't have orgs OR we don't have a global role, check the DB
    if (orgIds.length === 0 || !globalRole) {
      try {
        const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase');

        // 1. Try reading User Profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          // Merge/Found Orgs
          if (userData.orgIds?.length > 0) {
            // Union of claims and DB (DB takes precedence if claims empty)
            const dbOrgs = userData.orgIds;
            orgIds = Array.from(new Set([...orgIds, ...dbOrgs]));
            console.log('Using Org IDs from User Profile:', orgIds);
          }
          // Found Global Role
          if (userData.globalRole) {
            globalRole = userData.globalRole;
            console.log('Found Global Role in User Profile:', globalRole);
          }
          // Found Roles Map
          if (userData.roles) {
            rolesMap = userData.roles;
          }
        }

        // 1.5 Try reading from Employees collection (if user profile missing or empty)
        // ... (existing employee logic only needs to run if orgIds is still empty)
        if (orgIds.length === 0 && user.email) {
          const { query, where } = await import('firebase/firestore');
          const empQuery = query(
            collection(db, 'employees'),
            where('email', '==', user.email)
          );
          const empSnap = await getDocs(empQuery);
          if (!empSnap.empty) {
            const empData = empSnap.docs[0].data();
            if (empData.orgId) {
              orgIds = [empData.orgId];
              console.log('Using Org ID from Employee Record:', orgIds);
            }
          }
        }

        // 2. Legacy Fallback: Try Org Collection
        if (orgIds.length === 0) {
          const orgsSnapshot = await getDocs(collection(db, 'orgs'));
          if (!orgsSnapshot.empty) {
            orgIds = [orgsSnapshot.docs[0].id];
            console.log('No user profile orgs found, using first available org:', orgIds[0]);
          }
        }
      } catch (firestoreError: any) {
        // If permission denied, use a hardcoded org ID as last resort
        // This allows the app to work even without custom claims set
        if (firestoreError.code === 'permission-denied') {
          // Check localStorage for a saved orgId
          const savedOrgId = localStorage.getItem('fallbackOrgId');
          if (savedOrgId) {
            orgIds = [savedOrgId];
            console.log('Using saved fallback org:', savedOrgId);
          } else {
            console.warn('No custom claims and permission denied to read orgs. Please set Firebase custom claims with orgIds.');
          }
        }
      }
    }

    // Determine fallback globalRole if still undefined
    if (!globalRole) {
      globalRole = orgIds.length > 0 ? undefined : 'platform_user';
    }

    return {
      orgIds,
      role: (idTokenResult.claims.role as string) || 'painter',
      globalRole,
      rolesMap: rolesMap // Return the map we found
    };
  } catch (error) {
    console.error('Error getting user claims:', error);
    return null;
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
