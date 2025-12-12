import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";

export interface RunStatus {
  id: string;
  run_id?: string;
  status: "running" | "success" | "error" | "warning";
  started_at?: any;
  ended_at?: any;
  duration_ms?: number;
  mode?: string;
  trigger?: string;
  entity_counts?: Record<string, number>;
  counts?: {
    total?: number;
    by_type?: Record<string, number>;
    by_severity?: Record<string, number>;
  };
  error_message?: string;
  failed_checks?: string[];
  duration_fetch?: number;
  duration_checks?: number;
  duration_write_airtable?: number;
  duration_write_firestore?: number;
}

export function useRunStatus(runId: string | null) {
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!runId) {
      setLoading(false);
      setRunStatus(null);
      return;
    }

    const runRef = doc(db, "integrity_runs", runId);
    let retryTimeout: NodeJS.Timeout | null = null;

    const unsubscribe = onSnapshot(
      runRef,
      (snapshot) => {
        console.log(`[useRunStatus] Snapshot for runId ${runId}:`, {
          exists: snapshot.exists(),
          retryCount,
          data: snapshot.exists() ? snapshot.data() : null,
        });
        
        if (snapshot.exists()) {
          const data = snapshot.data();
          setRunStatus({
            id: snapshot.id,
            ...data,
          } as RunStatus);
          setLoading(false);
          setError(null);
          setRetryCount(0);
        } else {
          // Document doesn't exist yet - might be a new run
          // Retry a few times before showing error (with longer delays for new runs)
          if (retryCount < 10) {
            console.log(`[useRunStatus] Run ${runId} not found, retrying (attempt ${retryCount + 1}/10)...`);
            setLoading(true);
            // Use shorter delays initially, then longer ones
            const delay = retryCount < 3 ? 1000 : 2000 * (retryCount - 2);
            retryTimeout = setTimeout(() => {
              setRetryCount((prev) => prev + 1);
            }, delay);
          } else {
            console.error(`[useRunStatus] Run ${runId} not found after ${retryCount} retries`);
            setError("Run not found. The run may still be initializing. Please check the Runs page to see if it appears there.");
            setLoading(false);
          }
        }
      },
      (err) => {
        console.error("Error fetching run status:", err);
        // Retry on network errors
        if (err.code === "unavailable" && retryCount < 3) {
          retryTimeout = setTimeout(() => {
            setRetryCount((prev) => prev + 1);
          }, 2000 * (retryCount + 1));
        } else {
          setError(err.message);
          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribe();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [runId, retryCount]);

  return { runStatus, loading, error };
}
