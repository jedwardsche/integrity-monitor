#!/usr/bin/env node

/**
 * One-time script to grant admin access to specific email addresses.
 * Usage: node grant-admin-access.js
 * 
 * Requires GOOGLE_APPLICATION_CREDENTIALS environment variable or
 * Firebase Admin SDK default credentials.
 */

const {initializeApp, cert} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const path = require("path");
const fs = require("fs");

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID || "data-integrity-monitor";
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount),
    projectId: projectId,
  });
} else {
  // Use default credentials (e.g., from gcloud auth application-default login)
  initializeApp({
    projectId: projectId,
  });
}

const auth = getAuth();
const db = getFirestore();

const ADMIN_EMAILS = [
  "jedwards@che.school",
];

async function grantAdminAccess(email) {
  try {
    const user = await auth.getUserByEmail(email);
    const userRef = db.collection("users").doc(user.uid);
    await userRef.set({ isAdmin: true, email: email }, { merge: true });
    console.log(`✓ Granted admin access to ${email} (UID: ${user.uid})`);
    return { success: true, email, uid: user.uid };
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      console.error(`✗ User with email ${email} not found. User must sign in to the app first.`);
      return { success: false, email, error: "User not found" };
    }
    console.error(`✗ Error granting admin access to ${email}:`, error.message);
    return { success: false, email, error: error.message };
  }
}

async function main() {
  console.log("Granting admin access to users...\n");

  const results = [];
  for (const email of ADMIN_EMAILS) {
    const result = await grantAdminAccess(email);
    results.push(result);
  }

  console.log("\n--- Summary ---");
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed emails:");
    failed.forEach((r) => console.log(`  - ${r.email}: ${r.error}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
