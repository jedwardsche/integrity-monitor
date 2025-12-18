import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { Timestamp } from "firebase/firestore";

export interface ScheduleExecution {
  id: string;
  schedule_id: string;
  group_id: string;
  scheduled_for: Timestamp;
  started_at: Timestamp;
  status: "started" | "error";
  run_id?: string;
  error?: {
    message: string;
    code?: string;
  };
  run_config: {
    mode: "incremental" | "full";
    entities?: string[];
  };
}

export function useFirestoreScheduleExecutions(
  scheduleId: string,
  limitCount: number = 10
) {
  const [executions, setExecutions] = useState<ScheduleExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false);
      return;
    }

    const executionsRef = collection(db, "schedule_executions");
    const q = query(
      executionsRef,
      where("schedule_id", "==", scheduleId),
      orderBy("started_at", "desc"),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const transformed: ScheduleExecution[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ScheduleExecution[];
          setExecutions(transformed);
          setLoading(false);
          setError(null);
        } catch (err) {
          const errorMsg =
            err instanceof Error
              ? err.message
              : "Failed to process executions";
          console.error("Error processing schedule executions:", errorMsg, err);
          setError(errorMsg);
          setLoading(false);
        }
      },
      (err) => {
        console.error("Firestore subscription error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [scheduleId, limitCount]);

  return { data: executions, loading, error };
}
