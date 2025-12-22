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
  [key: string]: number | string;
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

            const trendItem: TrendDataItem = {
              day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            };

            // Extract counts by type - handle both structured (by_type) and flat (summary) formats
            let byType: Record<string, number> = {};
            
            if (data.by_type) {
              // Structured format: data.by_type exists
              byType = data.by_type;
            } else if (data.counts?.by_type) {
              // Nested format: data.counts.by_type exists
              byType = data.counts.by_type;
            } else {
              // Flat format: parse keys like "duplicate", "duplicate:critical", "missing_link:warning"
              // Aggregate by issue type (ignore severity suffixes)
              const typeCounts: Record<string, number> = {};
              Object.entries(data).forEach(([key, value]) => {
                // Skip non-numeric values and special keys
                if (typeof value !== 'number' || key === 'date' || key === 'updated_at' || key === 'total') {
                  return;
                }
                
                // Parse key format: "issue_type" or "issue_type:severity"
                const parts = key.split(':');
                const issueType = parts[0];
                
                // Only count the base type (not severity-specific counts)
                // This gives us total counts per issue type
                if (parts.length === 1) {
                  // Direct type count (e.g., "duplicate": 10)
                  typeCounts[issueType] = (typeCounts[issueType] || 0) + value;
                } else if (parts.length === 2 && parts[1] !== 'total') {
                  // Type:severity format (e.g., "duplicate:critical": 5)
                  // Aggregate all severities for the type
                  typeCounts[issueType] = (typeCounts[issueType] || 0) + value;
                }
              });
              byType = typeCounts;
            }

            // Add all issue types found in the data
            Object.entries(byType).forEach(([type, count]) => {
              if (typeof count === 'number' && count > 0) {
                trendItem[type] = count;
              }
            });

            // Ensure common types exist for consistency if needed, but 0 is fine
            // We rely on the graph to pick up keys

            trendData.push(trendItem);

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

