// This script sets custom claims on your Firebase user account
// Run this ONCE to configure your account properly

const admin = require("firebase-admin");

// Initialize Firebase Admin
// The service account JSON will be loaded from environment or a file
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");

if (!serviceAccount.project_id) {
  console.error(
    "\n❌ ERROR: FIREBASE_SERVICE_ACCOUNT environment variable not set!",
  );
  console.log("\nPlease follow these steps:");
  console.log(
    "1. Go to Firebase Console → Project Settings → Service Accounts",
  );
  console.log('2. Click "Generate New Private Key"');
  console.log("3. Copy the entire JSON content");
  console.log("4. In Replit, go to Secrets (lock icon in left sidebar)");
  console.log("5. Add a secret named: FIREBASE_SERVICE_ACCOUNT");
  console.log("6. Paste the JSON as the value");
  console.log("7. Run this script again\n");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setupUser() {
  try {
    // Change this to YOUR email address that you use to log in
    const userEmail = "ctaylor17@outlook.com";

    // Your org ID (we found this in the browser console)
    const orgId = "6o00yaTHMX7Y6zy7BlF5";

    console.log("\n🔍 Looking for user:", userEmail);

    const user = await admin.auth().getUserByEmail(userEmail);
    console.log("✅ Found user:", user.uid);

    console.log("\n⚙️  Setting custom claims...");
    await admin.auth().setCustomUserClaims(user.uid, {
      orgIds: [orgId],
      role: "owner",
    });

    console.log("✅ Custom claims set successfully!");
    console.log("\n📱 IMPORTANT NEXT STEPS:");
    console.log("1. Close your app browser tab completely");
    console.log("2. Clear your browser localStorage (or use incognito)");
    console.log("3. Log in again with your email/password");
    console.log(
      '4. The app should now work without the "No organization" error!\n',
    );

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

setupUser();
