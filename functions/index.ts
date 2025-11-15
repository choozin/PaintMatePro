import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// The service account is automatically available in the Cloud Functions environment
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Deletes a user from Firebase Authentication and their corresponding document in Firestore.
 * This function can only be called by an authenticated user with an 'owner' or 'admin' role.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  // Check for authentication and role
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const callerRole = context.auth.token.role;
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to perform this action.'
    );
  }

  const { userId, orgId } = data;

  if (!userId || !orgId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with "userId" and "orgId" arguments.'
    );
  }

  // Prevent users from deleting themselves
  if (context.auth.uid === userId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You cannot delete your own account.'
    );
  }

  try {
    // 1. Delete the user from Firebase Authentication
    await admin.auth().deleteUser(userId);
    console.log(`Successfully deleted user ${userId} from Authentication.`);

    // 2. Delete the user's document from the 'users' collection in Firestore
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.delete();
    console.log(`Successfully deleted user document for ${userId} from Firestore.`);

    return { success: true, message: `User ${userId} has been deleted.` };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'An unknown error occurred.'
    );
  }
});

/**
 * Updates a user's role within a specific organization.
 * This function can only be called by an authenticated user who is an 'org_owner' of the specified organization.
 */
export const updateUserRole = functions.https.onCall(async (data, context) => {
  // 1. Authenticate and Authorize Caller
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const callerUid = context.auth.uid;
  const callerClaims = context.auth.token;
  const callerOrgRole = callerClaims.orgs?.[data.orgId];

  // Only org_owners can update roles within their org
  if (callerOrgRole !== 'org_owner') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only an organization owner can update user roles.'
    );
  }

  const { userId, orgId, role } = data;

  if (!userId || !orgId || !role) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with "userId", "orgId", and "role" arguments.'
    );
  }

  // Prevent org_owners from changing their own role
  if (callerUid === userId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You cannot change your own role.'
    );
  }

  // Validate the new role
  const validRoles = ['org_owner', 'org_admin', 'member'];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid role specified.'
    );
  }

  try {
    // 2. Get Target User's Current Claims
    const targetUserRecord = await admin.auth().getUser(userId);
    const currentCustomClaims = targetUserRecord.customClaims || {};

    // 3. Update Target User's Custom Claims
    const updatedOrgRoles = {
      ...(currentCustomClaims.orgs || {}),
      [orgId]: role,
    };
    const newCustomClaims = {
      ...currentCustomClaims,
      orgs: updatedOrgRoles,
    };
    await admin.auth().setCustomUserClaims(userId, newCustomClaims);
    console.log(`Successfully updated custom claims for user ${userId}:`, newCustomClaims);

    // 4. Update Target User's Firestore Document
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.update({
      [`orgs.${orgId}`]: role, // Update the role in the Firestore document
    });
    console.log(`Successfully updated Firestore document for user ${userId} in org ${orgId} to role ${role}.`);

    return { success: true, message: `User ${userId} role updated to ${role} for organization ${orgId}.` };
  } catch (error: any) {
    console.error('Error updating user role:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'An unknown error occurred.'
    );
  }
});