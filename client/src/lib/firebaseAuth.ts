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
    return {
      orgIds: (idTokenResult.claims.orgIds as string[]) || [],
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
