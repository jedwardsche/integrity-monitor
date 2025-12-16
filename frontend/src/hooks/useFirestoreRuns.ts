import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";

export interface RunHistoryItem {
  id: string;
  trigger: string;
  time: string;
  anomalies: number;
  status: string;
  duration: string;
  run_id?: string;
  started_at?: any;
  ended_at?: any;
  mode?: string;
  duration_ms?: number;
  counts?: {
    total?: number;
    by_type?: Record<string, number>;
    by_severity?: Record<string, number>;
  };
}

export function useFirestoreRuns(limitCount: number = 10) {
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const runsRef = collection(db, "integrity_runs");
    const q = query(runsRef, orderBy("started_at", "desc"), limit(limitCount));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const transformed: RunHistoryItem[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            const runTime = data.started_at?.toDate?.() || data.ended_at?.toDate?.() || new Date();
            const date = runTime instanceof Date ? runTime : new Date(runTime);
            const timeStr = `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} • ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

            return {
              id: doc.id,
              run_id: doc.id,
              trigger: data.trigger || (data.mode === "full" ? "weekly" : "nightly"),
              time: timeStr,
              anomalies: data.counts?.total || 0,
              status: (() => {
                const statusLower = (data.status || "").toLowerCase();
                if (statusLower === "error") return "Error";
                if (statusLower === "warning") return "Warning";
                if (statusLower === "running") return "Running";
                if (statusLower === "cancelled" || statusLower === "canceled") return "Cancelled";
                if (statusLower === "success" || statusLower === "healthy") return "Healthy";
                return data.status || "Unknown";
              })(),
              duration: data.duration_ms
                ? `${Math.floor(data.duration_ms / 60000)}m ${Math.floor((data.duration_ms % 60000) / 1000)}s`
                : "N/A",
              started_at: data.started_at,
              ended_at: data.ended_at,
              mode: data.mode,
              duration_ms: data.duration_ms,
              counts: data.counts,
            };
          });
          setRuns(transformed);
          setLoading(false);
          setError(null);
          setRetryCount(0); // Reset retry count on success
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to process runs";
          console.error("Error processing Firestore runs:", errorMsg, err);
          setError(errorMsg);
          setLoading(false);
        }
      },
      (err) => {
        const errorCode = err.code;
        let userMessage = err.message;

        // Provide user-friendly error messages
        if (errorCode === "permission-denied") {
          userMessage = "Access denied. Please check your permissions.";
        } else if (errorCode === "unavailable") {
          userMessage = "Firestore service temporarily unavailable. Retrying...";

          // Auto-retry for network errors (max 3 attempts)
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount((prev) => prev + 1);
              setLoading(true);
            }, 2000 * (retryCount + 1)); // Exponential backoff
          }
        } else if (errorCode === "resource-exhausted") {
          userMessage = "Quota exceeded. Please try again later.";
        }

        console.error("Firestore subscription error:", errorCode, userMessage);
        setError(userMessage);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [limitCount, retryCount]);

  return { data: runs, loading, error };
}

