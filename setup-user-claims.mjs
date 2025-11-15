// This script sets custom claims on your Firebase user account
// Run this ONCE to configure your account properly

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

async function setupUser() {
  try {
    // Change this to YOUR email address that you use to log in
    const userEmail = 'ctaylor17@outlook.com';
    
    // Your org ID (we found this in the browser console)
    const orgId = '6o00yaTHMX7Y6zy7BlF5';

    console.log('\n🔍 Looking for user:', userEmail);
    
    const user = await admin.auth().getUserByEmail(userEmail);
    console.log('✅ Found user:', user.uid);

    console.log('\n⚙️  Setting custom claims...');
    const newClaims = {
      role: 'owner', // 'owner', 'admin', or 'member'
      orgIds: [orgId],
    };

    await admin.auth().setCustomUserClaims(user.uid, newClaims);

    console.log('✅ Custom claims set successfully with new structure!', newClaims);

    console.log('\n⚙️  Creating user document in Firestore...');
    const userDocRef = admin.firestore().collection('users').doc(user.uid);
    await userDocRef.set({
      email: user.email,
      displayName: user.displayName || 'Owner',
      orgId: orgId,
    });

    console.log('✅ User document created successfully!');
    console.log('\n📱 IMPORTANT NEXT STEPS:');
    console.log('1. Close your app browser tab completely');
    console.log('2. Clear your browser localStorage (or use incognito)');
    console.log('3. Log in again with your email/password');
    console.log('4. The app should now work without the "No organization" error!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.error('This email address is not registered in Firebase Auth');
      console.error('Make sure you typed the email exactly as it appears in Firebase Console\n');
    }
    process.exit(1);
  }
}

setupUser();
