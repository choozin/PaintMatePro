
import {
    collection,
    doc,
    getDocs,
    query,
    where,
    writeBatch,
    serverTimestamp,
    Timestamp,
    getDoc,
    deleteDoc
} from 'firebase/firestore';
import { db, auth, firebaseConfig } from './firebase';
import {
    orgOperations,
    employeeOperations,
    entitlementOperations,
    userOperations,
    User as FirestoreUser
} from './firestore';
import { registerUser } from './firebaseAuth';

/**
 * Creates a new Organization AND its Owner User account simultaneously.
 * Uses a SECONDARY Firebase App instance to avoid signing out the current admin.
 */
export async function createOrgWithOwner(orgName: string, ownerEmail: string, ownerPassword: string) {
    console.log('[AdminOps] Starting Create Org Flow (Secondary Auth) for:', orgName);

    // Dynamically import to avoid load-time issues if utilized elsewhere
    const { initializeApp, getApp, getApps, deleteApp } = await import('firebase/app');
    const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
    // Config imported at top level now

    // 1. Initialize Secondary App
    const SECONDARY_APP_NAME = 'secondaryAuthApp';
    let secondaryApp;

    if (getApps().some(app => app.name === SECONDARY_APP_NAME)) {
        secondaryApp = getApp(SECONDARY_APP_NAME);
    } else {
        // Ensure config is valid
        if (!firebaseConfig) {
            throw new Error("Firebase Config is missing. Cannot initialize secondary app.");
        }
        secondaryApp = initializeApp(firebaseConfig, SECONDARY_APP_NAME);
    }

    const secondaryAuth = getAuth(secondaryApp);

    try {
        // 2. Create User in Secondary Auth (Does NOT affect main 'auth' instance)
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, ownerEmail, ownerPassword);
        const user = userCredential.user;
        console.log('[AdminOps] Secondary Auth User Created:', user.uid);

        // 3. Manually Perform the Database Setup (since we can't reuse registerUser which uses main auth)
        // We can use the MAIN 'db' instance because we (the Admin) are authenticated there.
        // We are effectively provisioning data "on behalf of" the new user.

        // A. Create User Document
        await doc(db, 'users', user.uid); // Ensure ref exists
        await userOperations.set(user.uid, {
            id: user.uid,
            email: user.email!,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            orgIds: [], // Will be updated below
            roles: {},
            globalRole: 'org_owner' // Default for new org creators via admin
        });

        // B. Create Org
        const orgId = await orgOperations.create({
            name: orgName,
            plan: 'free',
            region: 'US',
            defaultUnits: 'imperial'
        });

        // C. Create Entitlements
        await entitlementOperations.create(orgId, {
            plan: 'free',
            features: {
                'capture.ar': true,
                'capture.reference': true,
                'visual.recolor': true,
                'portal.fullView': true,
                'pdf.watermark': true,
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

        // D. Create Employee Record
        // Note: employeeOperations.create adds createdAt/updatedAt automatically.
        // We omit 'id' passing here because create() generates a random ID by default unless we modify it.
        // BUT, looking at firestore.ts, employeeOperations.create uses addDocument which makes a random ID.
        // We want to force the ID to be the user UID for easier lookup as per original logic?
        // Actually the original logic in firebaseAuth used `employeeOperations.create({ id: user.uid ... })` 
        // which might have been a type violation if create() takes Omit<Employee, 'id'>.
        // Let's stick to standard patterns: allow random ID for employee record, but link via 'id' field if possible OR just rely on email/orgId.
        // Wait, the interface Employee has 'id'. The create helper OMITs 'id'. 
        // So we CANNOT pass 'id' to create(). 
        // If we really want custom ID, we'd need a set() helper for employees too. 
        // For now, let's let Firestore generate the ID, we query by email anyway.
        await employeeOperations.create({
            orgId: orgId,
            name: ownerEmail.split('@')[0],
            email: ownerEmail,
            role: 'admin' // Used as a fallback/descriptive role in Employee record.
        });

        // E. Update User Doc with Org/Role
        await userOperations.update(user.uid, {
            orgIds: [orgId],
            roles: { [orgId]: 'org_owner' }
        });

        console.log('[AdminOps] Org & User Provisioning Complete.');

        // 4. Cleanup Secondary Auth
        await signOut(secondaryAuth);
        // Look into deleting the app if frequent usage isn't expected, 
        // but keeping it initialized is also fine. deleteApp helps cleanup resources.
        await deleteApp(secondaryApp);

        return { orgId, userId: user.uid };

    } catch (error) {
        console.error('[AdminOps] Failed to create org with owner:', error);
        // Attempt cleanup if app exists
        try { await deleteApp(secondaryApp); } catch (e) { /* ignore */ }
        throw error;
    }
}

/**
 * Deep Cleans an Organization by deleting ALL associated data.
 * Cascades deletes to: Projects, Clients, Quotes, Time Entries, Crews, Dev Notes, Employees, Entitlements.
 * Finally updates Users to remove the org association.
 */
export async function deleteOrgDeep(orgId: string) {
    console.log('[AdminOps] Starting Deep Clean for Org:', orgId);
    const batchLimit = 450; // Firestore batch limit is 500, keeping safety margin

    // Helper to delete collection by orgId
    const deleteCollectionByOrg = async (collectionName: string) => {
        console.log(`[AdminOps] Deleting ${collectionName}...`);
        const q = query(collection(db, collectionName), where('orgId', '==', orgId));
        const snapshot = await getDocs(q);

        // Process in chunks
        const chunks = [];
        let currentBatch = writeBatch(db);
        let count = 0;

        for (const doc of snapshot.docs) {
            currentBatch.delete(doc.ref);
            count++;
            if (count >= batchLimit) {
                chunks.push(currentBatch.commit());
                currentBatch = writeBatch(db);
                count = 0;
            }
        }
        if (count > 0) {
            chunks.push(currentBatch.commit());
        }
        await Promise.all(chunks);
        console.log(`[AdminOps] Deleted ${snapshot.size} docs from ${collectionName}`);
    };

    try {
        // 1. Delete Sub-Collections / Related Data
        await deleteCollectionByOrg('projects');
        await deleteCollectionByOrg('clients');
        await deleteCollectionByOrg('quotes');
        await deleteCollectionByOrg('time_entries');
        await deleteCollectionByOrg('crews');
        await deleteCollectionByOrg('dev_notes');
        await deleteCollectionByOrg('entitlements'); // Should be only 1, but safe to query

        // 2. Handle Employees & Users
        // We need to fetch employees first to know WHICH users to update
        const empQuery = query(collection(db, 'employees'), where('orgId', '==', orgId));
        const empSnapshot = await getDocs(empQuery);

        console.log(`[AdminOps] Processing ${empSnapshot.size} employees for unlinking...`);

        // We can't batch user updates easily if they are many, so we'll do them one by one or in small batches
        // For safety and simpler logic, we'll iterate.
        const userUpdates = empSnapshot.docs.map(async (empDoc) => {
            const empData = empDoc.data();
            // Try to find the user by email (best effort since we don't always have uid in employee doc)
            // Actually, employee doc MIGHT have 'id' matching auth uid if created correctly, let's check
            // If employee.id matches a user, great. If not, query users by email.

            let userRef = null;
            let userData = null;

            // Try ID match first (if employee ID is UID)
            const potentialUserDoc = await getDoc(doc(db, 'users', empDoc.id));
            if (potentialUserDoc.exists()) {
                userRef = potentialUserDoc.ref;
                userData = potentialUserDoc.data();
            } else if (empData.email) {
                // Fallback to email query
                const userQ = query(collection(db, 'users'), where('email', '==', empData.email));
                const userSnaps = await getDocs(userQ);
                if (!userSnaps.empty) {
                    userRef = userSnaps.docs[0].ref;
                    userData = userSnaps.docs[0].data();
                }
            }

            if (userRef && userData) {
                // Remove OrgID from array
                const newOrgIds = (userData.orgIds || []).filter((id: string) => id !== orgId);
                // Remove Role from map
                const newRoles = { ...(userData.roles || {}) };
                delete newRoles[orgId];

                // Update User
                await userOperations.update(userRef.id, {
                    orgIds: newOrgIds,
                    roles: newRoles
                });
            }

            // Finally delete the employee doc
            await deleteDoc(empDoc.ref);
        });

        await Promise.all(userUpdates);
        console.log('[AdminOps] Employees deleted and Users updated.');

        // 3. Delete the Org Doc itself
        await deleteDoc(doc(db, 'orgs', orgId));
        console.log('[AdminOps] Org Deep Clean Complete.');

    } catch (error) {
        console.error('[AdminOps] Deep Clean Failed:', error);
        throw error;
    }
}

/**
 * Unassigns a user from an organization.
 * Removes orgId from user's profile and deletes the employee record.
 */
export async function unassignUser(userId: string, orgId: string, userEmail?: string) {
    console.log(`[AdminOps] Unassigning User ${userId} from Org ${orgId}`);

    try {
        // 1. Update User Doc
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const newOrgIds = (userData.orgIds || []).filter((id: string) => id !== orgId);
            const newRoles = { ...(userData.roles || {}) };
            delete newRoles[orgId];

            await userOperations.update(userId, {
                orgIds: newOrgIds,
                roles: newRoles
            });
        }

        // 2. Delete Employee Record
        // We need to find the specific employee record for this org + user/email
        // Try by ID first (if employee ID = user ID)
        const empDocRef = doc(db, 'employees', userId);
        const empDocSnap = await getDoc(empDocRef); // Check if this ID exists in employees

        if (empDocSnap.exists() && empDocSnap.data().orgId === orgId) {
            await deleteDoc(empDocRef);
        } else {
            // Search by email + orgId if ID didn't match
            const emailToSearch = userEmail || userSnap.data()?.email;
            if (emailToSearch) {
                const q = query(
                    collection(db, 'employees'),
                    where('orgId', '==', orgId),
                    where('email', '==', emailToSearch)
                );
                const snaps = await getDocs(q);
                const deletePromises = snaps.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
            }
        }

        console.log('[AdminOps] Unassign Complete.');
    } catch (error) {
        console.error('[AdminOps] Unassign Failed:', error);
        throw error;
    }
}

/**
 * Deletes a user's data from Firestore ("Data Wipe").
 * Does NOT delete Auth account (requires Admin SDK).
 */
export async function deleteUserDataWipe(userId: string) {
    console.log(`[AdminOps] Wiping Data for User ${userId}`);

    try {
        // 1. Get User to find email
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        const userEmail = userSnap.data()?.email;

        // 2. Delete all Employee records for this email (across all orgs)
        if (userEmail) {
            const q = query(collection(db, 'employees'), where('email', '==', userEmail));
            const snaps = await getDocs(q);
            const deletePromises = snaps.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
        }

        // 3. Delete User Doc
        await deleteDoc(userDocRef);

        console.log('[AdminOps] Data Wipe Complete.');
    } catch (error) {
        console.error('[AdminOps] Data Wipe Failed:', error);
        throw error;
    }
}

/**
 * Changes the owner of an organization.
 * Demotes the current owner to 'org_admin' and promotes the new user to 'org_owner'.
 */
export async function changeOrgOwner(orgId: string, newOwnerUserId: string) {
    console.log(`[AdminOps] Changing Owner for Org ${orgId} to User ${newOwnerUserId}`);

    try {
        // 1. Find Current Owner(s)
        // We query users who have 'org_owner' role for this org
        // Note: Ideally there should be only one, but we handle multiple just in case
        const usersRef = collection(db, 'users');
        // Firestore map queries are tricky. We can't easily query `roles.${orgId} == 'org_owner'` if key is dynamic?
        // Actually we can: where(`roles.${orgId}`, '==', 'org_owner')
        const q = query(usersRef, where(`roles.${orgId}`, '==', 'org_owner'));
        const snapshot = await getDocs(q);

        const updates = [];

        // 2. Demote Current Owner(s)
        snapshot.forEach(doc => {
            if (doc.id !== newOwnerUserId) { // Skip if we are promoting the same person (idempotency)
                const userData = doc.data();
                const newRoles = { ...(userData.roles || {}) };
                newRoles[orgId] = 'org_admin'; // Demote to Admin

                updates.push(userOperations.update(doc.id, { roles: newRoles }));
                console.log(`[AdminOps] Demoting previous owner: ${doc.id}`);
            }
        });

        // 3. Promote New Owner
        // We need to fetch the new owner's current roles first
        const newOwnerDoc = await getDoc(doc(db, 'users', newOwnerUserId));
        if (!newOwnerDoc.exists()) {
            throw new Error(`User ${newOwnerUserId} not found.`);
        }

        const newOwnerData = newOwnerDoc.data();
        const targetRoles = { ...(newOwnerData.roles || {}) };
        targetRoles[orgId] = 'org_owner';

        // Ensure orgId is in their list if not already
        const targetOrgIds = newOwnerData.orgIds || [];
        if (!targetOrgIds.includes(orgId)) {
            targetOrgIds.push(orgId);
        }

        updates.push(userOperations.update(newOwnerUserId, {
            roles: targetRoles,
            orgIds: targetOrgIds
        }));

        // 4. Update Employee Records (Visual Reflection)
        // We should update the 'role' field in employees collection for consistency
        // Find employee record for new owner
        const empQ = query(collection(db, 'employees'), where('orgId', '==', orgId));
        const empSnap = await getDocs(empQ);

        empSnap.forEach(empDoc => {
            const emp = empDoc.data();
            // Check if this employee matches old owners (by email or id lookup?)
            // Since employee doc might not have UID, we might need to match by email if available.
            // This is "nice to have" sync.

            // A. If matches NEW owner (by ID or Email)
            if (emp.id === newOwnerUserId || (emp.email && emp.email === newOwnerData.email)) {
                updates.push(employeeOperations.update(empDoc.id, { role: 'admin' })); // 'admin' is the label for owners/admins usually
            }
        });

        await Promise.all(updates);
        console.log('[AdminOps] Owner Change Complete.');

    } catch (error) {
        console.error('[AdminOps] Change Owner Failed:', error);
        throw error;
    }
}
