import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "../config/firebase";

export interface RunLog {
  id: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  timestamp: any;
  [key: string]: any;
}

export function useRunLogs(runId: string | null) {
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setLoading(false);
      setLogs([]);
      return;
    }

    const logsRef = collection(db, "integrity_runs", runId, "logs");
    const q = query(logsRef, orderBy("timestamp", "desc"), limit(500));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logEntries: RunLog[] = [];
        snapshot.forEach((doc) => {
          logEntries.push({
            id: doc.id,
            ...doc.data(),
          } as RunLog);
        });
        // Reverse to show oldest first
        setLogs(logEntries.reverse());
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error fetching run logs:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [runId]);

  return { logs, loading, error };
}
