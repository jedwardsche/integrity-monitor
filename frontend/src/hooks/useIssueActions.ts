import { useState } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../config/firebase";

export function useIssueActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markResolved = async (issueId: string, resolutionNotes?: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // Verify admin status to prevent race conditions
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || !userDoc.data()?.isAdmin) {
        throw new Error("Unauthorized: Admin access required");
      }

      const issueRef = doc(db, "integrity_issues", issueId);
      await updateDoc(issueRef, {
        status: "resolved",
        resolved_at: new Date(),
        resolution_notes: resolutionNotes || "",
        resolved_by: user.uid,
      });
      setLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark issue as resolved");
      setLoading(false);
      throw err;
    }
  };

  const markIgnored = async (issueId: string, reason?: string) => {
    setLoading(true);
    setError(null);
    try {
      const issueRef = doc(db, "integrity_issues", issueId);
      await updateDoc(issueRef, {
        status: "ignored",
        ignored_at: new Date(),
        ignore_reason: reason || "",
        ignored_by: "user",
      });
      setLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark issue as ignored");
      setLoading(false);
      throw err;
    }
  };

  return {
    markResolved,
    markIgnored,
    loading,
    error,
  };
}

