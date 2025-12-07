# Firebase Deployment Guide

> [!IMPORTANT]
> **Live Firebase Project:** This application connects to a **LIVE** Firebase project, not a local emulator.
> Any changes to `firestore.rules`, `storage.rules`, or Cloud Functions must be **deployed** to take effect.

## How to Deploy Security Rules

If you have the Firebase CLI installed and authenticated:

```bash
firebase deploy --only firestore:rules
```

If you do not have the CLI or prefer the web interface:
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project.
3.  Navigate to **Firestore Database** > **Rules**.
4.  Copy the content of `firestore.rules` from your local project.
5.  Paste it into the editor in the console.
6.  Click **Publish**.

## Current Rules Status
The `firestore.rules` file in this project contains critical updates for:
- **Catalog Items:** Access control for the new Price Catalog feature.
- **Organization Management:** Rules for managing orgs and entitlements.

**These rules must be deployed for the application to function correctly.**
