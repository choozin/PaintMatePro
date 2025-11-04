import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

export interface AuthUser extends User {
  customClaims?: {
    orgIds?: string[];
    role?: 'owner' | 'admin' | 'member';
  };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<UserCredential> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Force token refresh to get custom claims
    await userCredential.user.getIdToken(true);
    return userCredential;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(error.message || 'Failed to sign in');
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
 * Get the current user's custom claims (orgIds, role)
 */
export async function getUserClaims(): Promise<{ orgIds: string[]; role: string } | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const idTokenResult = await user.getIdTokenResult();
    let orgIds = (idTokenResult.claims.orgIds as string[]) || [];
    
    // Fallback: if no custom claims, try to get the first org from Firestore
    if (orgIds.length === 0) {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        const orgsSnapshot = await getDocs(collection(db, 'orgs'));
        
        if (!orgsSnapshot.empty) {
          orgIds = [orgsSnapshot.docs[0].id];
          console.log('No custom claims found, using first available org:', orgIds[0]);
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
    
    return {
      orgIds,
      role: (idTokenResult.claims.role as string) || 'member',
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
