import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../config/firebase";

interface IssueCounts {
  all: number;
  open: number;
  closed: number;
  resolved: number;
}

export function useIssueCounts() {
  const [counts, setCounts] = useState<IssueCounts>({
    all: 0,
    open: 0,
    closed: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const issuesRef = collection(db, "integrity_issues");

        // Run all count queries in parallel
        const [allResult, openResult, closedResult, resolvedResult] =
          await Promise.all([
            getCountFromServer(query(issuesRef)),
            getCountFromServer(
              query(issuesRef, where("status", "==", "open"))
            ),
            getCountFromServer(
              query(issuesRef, where("status", "==", "closed"))
            ),
            getCountFromServer(
              query(issuesRef, where("status", "==", "resolved"))
            ),
          ]);

        if (!cancelled) {
          setCounts({
            all: allResult.data().count,
            open: openResult.data().count,
            closed:
              closedResult.data().count + resolvedResult.data().count,
            resolved: resolvedResult.data().count,
          });
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching issue counts:", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch counts"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchCounts();

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchCounts, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { counts, loading, error };
}
