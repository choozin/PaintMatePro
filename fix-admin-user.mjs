
import admin from 'firebase-admin';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the service account key from the JSON file
const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(await fs.readFile(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function fixAdminUser() {
    try {
        const userEmail = 'ctaylor17@outlook.com';
        console.log('\n🔍 Looking for user:', userEmail);

        const user = await admin.auth().getUserByEmail(userEmail);
        console.log('✅ Found Auth User:', user.uid);

        // 1. Update Firestore User Document (This is the Source of Truth now)
        console.log('⚙️  Updating Firestore User Document...');
        const userDocRef = admin.firestore().collection('users').doc(user.uid);

        // Get existing data to preserve orgId if present
        const docSnap = await userDocRef.get();
        const existingData = docSnap.data() || {};

        // Convert legacy 'orgId' to 'orgIds' array if needed
        let orgIds = existingData.orgIds || [];
        if (existingData.orgId && !orgIds.includes(existingData.orgId)) {
            orgIds.push(existingData.orgId);
        }

        await userDocRef.set({
            ...existingData,
            email: user.email,
            globalRole: 'platform_owner', // Critical: Grants Super Admin Access
            orgIds: orgIds,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('✅ User Document Updated: globalRole = platform_owner');

        console.log('\n📱 ACTION REQUIRED:');
        console.log('1. Reload the App.');
        console.log('2. Log in as', userEmail);
        console.log('3. You should now see the Admin features or Org Selection.');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

fixAdminUser();
