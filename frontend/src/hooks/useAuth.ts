import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user document exists in Firestore with email
        try {
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);

          //console.log("🔍 Auth Debug - User:", user.email, "UID:", user.uid);
          //console.log("🔍 Auth Debug - Firestore doc exists:", userDoc.exists());
          //console.log("🔍 Auth Debug - Firestore doc data:", userDoc.data());

          // Get email from user object (works for both email/password and Google sign-in)
          const userEmail = user.email || user.providerData?.[0]?.email || null;

          // Create or update user document with email if it doesn't exist or email is missing
          if (!userDoc.exists() || !userDoc.data()?.email) {
            //console.log("🔍 Auth Debug - Creating/updating user doc with email");
            await setDoc(userRef, { email: userEmail }, { merge: true });
          }

          // Check admin status - check both by UID and by email
          const updatedDoc = await getDoc(userRef);
          let isAdmin = updatedDoc.exists() && updatedDoc.data()?.isAdmin === true;

          //console.log("🔍 Auth Debug - Updated doc data:", updatedDoc.data());
          //console.log("🔍 Auth Debug - isAdmin value:", isAdmin);
          //console.log("🔍 Auth Debug - Raw isAdmin field:", updatedDoc.data()?.isAdmin);

          // If not admin by UID, check if email is in admin list
          if (!isAdmin && userEmail) {
            //console.log("🔍 Auth Debug - Not admin by UID, checking by email...");
            // Check if any user document with this email has admin access
            const { collection, query, where, getDocs } = await import("firebase/firestore");
            const adminQuery = query(collection(db, "users"), where("email", "==", userEmail), where("isAdmin", "==", true));
            const adminDocs = await getDocs(adminQuery);
            //console.log("🔍 Auth Debug - Admin docs found:", adminDocs.size);
            if (!adminDocs.empty) {
              // Grant admin to this UID as well
              //console.log("🔍 Auth Debug - Granting admin to this UID");
              await setDoc(userRef, { isAdmin: true, email: userEmail }, { merge: true });
              isAdmin = true;
            }
          }

          //console.log("🔍 Auth Debug - Final isAdmin status:", isAdmin);
          setState({ user, isAdmin, loading: false, error: null });
        } catch (error) {
          console.error("❌ Auth Error:", error);
          setState({
            user,
            isAdmin: false,
            loading: false,
            error: error instanceof Error ? error.message : "Failed to check admin status",
          });
        }
      } else {
        setState({ user: null, isAdmin: false, loading: false, error: null });
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Sign in failed",
      }));
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Google sign in failed",
      }));
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Sign out failed",
      }));
      throw error;
    }
  };

  const signInWithDevToken = async (customToken: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await signInWithCustomToken(auth, customToken);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Custom token sign in failed",
      }));
      throw error;
    }
  };

  const getToken = async (): Promise<string | null> => {
    if (!state.user) return null;
    return await state.user.getIdToken();
  };

  return {
    ...state,
    signIn,
    signInWithGoogle,
    signInWithDevToken,
    signOut,
    getToken,
  };
}

