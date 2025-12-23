import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot, where, getCountFromServer } from "firebase/firestore";
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
  duration_ms?: number;
  counts?: {
    total?: number;
    by_type?: Record<string, number>;
    by_severity?: Record<string, number>;
    by_type_severity?: Record<string, number>;
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
            // Always use started_at for date display, never fall back to ended_at
            // This ensures the displayed date is always the original start time, not the cancellation time
            const runTime = data.started_at?.toDate?.() || new Date();
            const date = runTime instanceof Date ? runTime : new Date(runTime);
            const timeStr = `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} • ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

            return {
              id: doc.id,
              run_id: doc.id,
              trigger: data.trigger || "nightly",
              time: timeStr,
              anomalies: data.counts?.total || 0,
              status: (() => {
                const statusLower = (data.status || "").toLowerCase();
                if (statusLower === "error") return "Error";
                if (statusLower === "timeout") return "Timeout";
                if (statusLower === "critical") return "Critical";
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
              duration_ms: data.duration_ms,
              counts: data.counts,
            };
          });
          
          // Sort by started_at descending to ensure stable order (by date, not status)
          // This prevents reordering when status changes
          transformed.sort((a, b) => {
            // Get started_at timestamp only (never use ended_at for sorting)
            const getTimestamp = (run: RunHistoryItem): number => {
              if (run.started_at) {
                const date = run.started_at?.toDate?.() || run.started_at;
                if (date instanceof Date) return date.getTime();
                if (typeof date === 'number') return date;
                try {
                  return new Date(date).getTime();
                } catch {
                  return 0;
                }
              }
              return 0;
            };
            
            const aTime = getTimestamp(a);
            const bTime = getTimestamp(b);
            
            // If timestamps are equal, use ID as tiebreaker for stable sort
            if (aTime === bTime) {
              return (b.id || '').localeCompare(a.id || '');
            }
            
            return bTime - aTime; // Descending order (newest first)
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

export function useNewIssuesFromRecentRuns(limitCount: number = 3) {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: runs, loading: runsLoading } = useFirestoreRuns(limitCount);

  useEffect(() => {
    if (runsLoading || runs.length === 0) {
      setLoading(runsLoading);
      return;
    }

    const fetchNewIssuesCount = async () => {
      try {
        setLoading(true);
        const issuesRef = collection(db, "integrity_issues");
        
        // Get run IDs from the last N runs
        const runIds = runs.slice(0, limitCount).map(run => run.id || run.run_id).filter(Boolean);
        
        if (runIds.length === 0) {
          setCount(0);
          setLoading(false);
          return;
        }

        // Build query with OR conditions for first_seen_in_run matching any run ID
        // Firestore requires using 'in' operator for up to 10 values, or multiple queries
        if (runIds.length <= 10) {
          const q = query(
            issuesRef,
            where("first_seen_in_run", "in", runIds)
          );
          const snapshot = await getCountFromServer(q);
          setCount(snapshot.data().count);
        } else {
          // If more than 10 runs, query in batches
          let totalCount = 0;
          for (let i = 0; i < runIds.length; i += 10) {
            const batch = runIds.slice(i, i + 10);
            const q = query(
              issuesRef,
              where("first_seen_in_run", "in", batch)
            );
            const snapshot = await getCountFromServer(q);
            totalCount += snapshot.data().count;
          }
          setCount(totalCount);
        }
        
        setError(null);
      } catch (err: any) {
        const errorCode = err.code;
        let userMessage = err.message;

        if (errorCode === "permission-denied") {
          userMessage = "Access denied. Please check your permissions.";
        } else if (errorCode === "resource-exhausted") {
          userMessage = "Quota exceeded. Please try again later.";
        } else if (errorCode === "unavailable" || errorCode === "deadline-exceeded") {
          userMessage = "Service temporarily unavailable. Please try again.";
        }

        console.error("Error fetching new issues count:", errorCode, err.message);
        setError(userMessage);
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchNewIssuesCount();
  }, [runs, runsLoading, limitCount]);

  return { count, loading, error };
}

