import { useState } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { API_BASE } from "../config/api";

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

  const deleteIssue = async (issueId: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      // Get Firebase ID token for API authentication
      const token = await user.getIdToken();

      const response = await fetch(`${API_BASE}/integrity/issue/${issueId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to delete issue" }));
        throw new Error(errorData.error || "Failed to delete issue");
      }

      setLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete issue");
      setLoading(false);
      throw err;
    }
  };

  return {
    markResolved,
    markIgnored,
    deleteIssue,
    loading,
    error,
  };
}

