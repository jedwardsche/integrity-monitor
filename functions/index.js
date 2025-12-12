const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions");
const logger = require("firebase-functions/logger");

initializeApp();
const db = getFirestore();

setGlobalOptions({ maxInstances: 10 });

/**
 * Grant admin access to a user by email address.
 * Creates or updates the user document in Firestore with isAdmin: true.
 */
exports.grantAdminAccess = onCall(async (request) => {
  const email = request.data.email;

  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "Email is required and must be a string");
  }

  try {
    const auth = getAuth();
    let user;

    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        throw new HttpsError("not-found", `User with email ${email} not found. User must sign in first.`);
      }
      throw error;
    }

    const userRef = db.collection("users").doc(user.uid);
    await userRef.set({ isAdmin: true, email: email }, { merge: true });

    logger.info(`Granted admin access to ${email}`, { uid: user.uid, email: email });

    return { success: true, message: `Admin access granted to ${email}`, uid: user.uid };
  } catch (error) {
    logger.error("Error granting admin access", { error: error.message, email: email });
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", `Failed to grant admin access: ${error.message}`);
  }
});
