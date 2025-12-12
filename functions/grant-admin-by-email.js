#!/usr/bin/env node

/**
 * Grant admin access to a user by email address (works for both email/password and Google sign-in).
 * Usage: node grant-admin-by-email.js <email>
 * 
 * Requires GOOGLE_APPLICATION_CREDENTIALS environment variable or
 * Firebase Admin SDK default credentials.
 */

const {initializeApp, cert} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const fs = require("fs");

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error("Usage: node grant-admin-by-email.js <email>");
  process.exit(1);
}

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

async function grantAdminAccessByEmail(email) {
  try {
    // Find all users with this email (could be multiple if they signed in with different methods)
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
  console.log(`Granting admin access to ${email}...\n`);
  const result = await grantAdminAccessByEmail(email);
  
  if (result.success) {
    console.log("\n✓ Success! The user now has admin access.");
    console.log(`  Email: ${result.email}`);
    console.log(`  UID: ${result.uid}`);
  } else {
    console.log("\n✗ Failed to grant admin access.");
    console.log(`  Error: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
