import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

export interface TrendDataItem {
  day: string;
  duplicates: number;
  links: number;
  attendance: number;
}

export interface SeverityCounts {
  critical: number;
  warning: number;
  info: number;
}

export function useFirestoreMetrics(days: number = 14) {
  const [trends, setTrends] = useState<TrendDataItem[]>([]);
  const [severityCounts, setSeverityCounts] = useState<SeverityCounts>({ critical: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const metricsRef = collection(db, "integrity_metrics_daily");
    const q = query(metricsRef, orderBy("date", "desc"), limit(days));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const trendData: TrendDataItem[] = [];
          let latestSeverity = { critical: 0, warning: 0, info: 0 };

          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const dateStr = data.date || doc.id;
            let date: Date;

            // Parse date string (YYYYMMDD format)
            if (typeof dateStr === "string" && dateStr.length === 8) {
              const year = parseInt(dateStr.substring(0, 4));
              const month = parseInt(dateStr.substring(4, 6)) - 1;
              const day = parseInt(dateStr.substring(6, 8));
              date = new Date(year, month, day);
            } else if (data.updated_at?.toDate) {
              date = data.updated_at.toDate();
            } else {
              date = new Date();
            }

            // Extract counts by type
            const duplicates = data.by_type?.duplicate || data.counts?.by_type?.duplicate || 0;
            const links = data.by_type?.missing_link || data.counts?.by_type?.missing_link || 0;
            const attendance = data.by_type?.attendance || data.counts?.by_type?.attendance || 0;

            trendData.push({
              day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              duplicates,
              links,
              attendance,
            });

            // Use most recent document for severity counts
            if (snapshot.docs.indexOf(doc) === 0) {
              latestSeverity = {
                critical: data.by_severity?.critical || data.counts?.by_severity?.critical || 0,
                warning: data.by_severity?.warning || data.counts?.by_severity?.warning || 0,
                info: data.by_severity?.info || data.counts?.by_severity?.info || 0,
              };
            }
          });

          // Reverse to show chronological order
          setTrends(trendData.reverse());
          setSeverityCounts(latestSeverity);
          setLoading(false);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to process metrics");
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [days]);

  return { trends, severityCounts, loading, error };
}

