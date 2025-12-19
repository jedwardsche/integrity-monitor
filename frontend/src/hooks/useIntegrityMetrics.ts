import { useMemo } from "react";
import { useFirestoreRuns } from "./useFirestoreRuns";
import { useFirestoreMetrics } from "./useFirestoreMetrics";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import { useEffect, useState } from "react";

type IssueSummary = {
  total: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_type_severity: Record<string, number>;
};

type MetricsSummary = {
  summary: IssueSummary;
  last_run: any;
  last_run_time?: string;
  last_run_duration?: number;
};

type RunHistoryItem = {
  id: string;
  trigger: string;
  time: string;
  anomalies: number;
  status: string;
  duration: string;
};

type TrendDataItem = {
  day: string;
  duplicates: number;
  links: number;
  attendance: number;
};

type IssueQueue = {
  title: string;
  detail: string;
  count: number;
  chip: string;
};

type DerivedMetrics = {
  critical_records: number;
  duplicate_rate: number;
  link_health: number;
  data_completeness: number;
  attendance_health?: number;
  base_health?: number;
  total_records: number;
};

type FlaggedRule = {
  id?: string;
  rule_id: string;
  ignored_count: number;
  total_count: number;
  ignored_percentage: number;
  flagged_at?: any;
};

export function useIntegrityMetrics() {
  // Use Firestore hooks
  const runsHook = useFirestoreRuns(10);
  const { trends, severityCounts, loading: metricsLoading, error: metricsError } = useFirestoreMetrics(7);
  
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [queues, setQueues] = useState<IssueQueue[]>([]);
  const [queuesLoading, setQueuesLoading] = useState(true);
  const [queuesError, setQueuesError] = useState<string | null>(null);

  const [derived, setDerived] = useState<DerivedMetrics | null>(null);
  const [derivedLoading, setDerivedLoading] = useState(true);
  const [derivedError, setDerivedError] = useState<string | null>(null);

  const [flaggedRules, setFlaggedRules] = useState<FlaggedRule[]>([]);
  const [flaggedRulesLoading, setFlaggedRulesLoading] = useState(true);
  const [flaggedRulesError, setFlaggedRulesError] = useState<string | null>(null);

  const [kpiData, setKpiData] = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  // Load summary from latest run
  useEffect(() => {
    if (runsHook.data.length > 0) {
      const latestRun = runsHook.data[0];
      const counts = latestRun.counts || {};
      
      // Calculate by_severity from by_type_severity if not present
      let bySeverity = counts.by_severity || {};
      if (!counts.by_severity && counts.by_type_severity) {
        bySeverity = { critical: 0, warning: 0, info: 0 };
        Object.entries(counts.by_type_severity).forEach(([key, value]) => {
          if (typeof value === 'number' && key.includes(':')) {
            const severity = key.split(':')[1];
            if (severity === 'critical' || severity === 'warning' || severity === 'info') {
              bySeverity[severity] = (bySeverity[severity] || 0) + value;
            }
          }
        });
      }
      
      // Fallback to severityCounts from metrics if still empty
      if (Object.keys(bySeverity).length === 0) {
        bySeverity = severityCounts;
      }
      
      setSummary({
        summary: {
          total: counts.total || 0,
          by_type: counts.by_type || {},
          by_severity: (counts.by_severity || severityCounts) as Record<string, number>,
          by_type_severity: (counts.by_type_severity || {}) as Record<string, number>,
        },
        last_run: latestRun,
        last_run_time: latestRun.started_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        last_run_duration: latestRun.duration_ms || 0,
      });
      setSummaryLoading(false);
    } else if (!runsHook.loading) {
      setSummary({
        summary: {
          total: 0,
          by_type: {},
          by_severity: severityCounts,
          by_type_severity: {},
        },
        last_run: null,
      });
      setSummaryLoading(false);
    }
  }, [runsHook.data, runsHook.loading, severityCounts]);

  // Load issue queues from Firestore
  useEffect(() => {
    const issuesRef = collection(db, "integrity_issues");
    const q = query(issuesRef, where("status", "==", "open"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const issues = snapshot.docs.map((doc) => doc.data());
          
          // Group by issue type and rule_id
          const byType: Record<string, number> = {};
          const byRule: Record<string, number> = {};
          
          issues.forEach((issue) => {
            const type = issue.issue_type || "unknown";
            byType[type] = (byType[type] || 0) + 1;
            
            const ruleId = issue.rule_id || "";
            if (ruleId) {
              byRule[ruleId] = (byRule[ruleId] || 0) + 1;
            }
          });

          // Build issue queues
          const queuesList: IssueQueue[] = [];
          
          if (byType.duplicate) {
            queuesList.push({
              title: "Duplicate Records",
              detail: "Students, parents, or contractors with potential duplicates",
              count: byType.duplicate,
              chip: "Identity",
            });
          }
          
          if (byType.missing_link) {
            queuesList.push({
              title: "Missing Links",
              detail: "Broken relationships between entities",
              count: byType.missing_link,
              chip: "Schema",
            });
          }
          
          if (byType.attendance) {
            queuesList.push({
              title: "Attendance Anomalies",
              detail: "Excessive absences or attendance issues",
              count: byType.attendance,
              chip: "Risk",
            });
          }
          
          if (byType.missing_field) {
            queuesList.push({
              title: "Missing Fields",
              detail: "Required fields not populated",
              count: byType.missing_field,
              chip: "Data",
            });
          }

          setQueues(queuesList);
          setQueuesLoading(false);
          setQueuesError(null);
        } catch (err) {
          setQueuesError(err instanceof Error ? err.message : "Failed to load queues");
          setQueuesLoading(false);
        }
      },
      (err) => {
        setQueuesError(err.message);
        setQueuesLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch derived metrics from API
  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || window.location.origin;
    setDerivedLoading(true);
    
    fetch(`${API_BASE}/integrity/metrics/derived`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDerived(data as DerivedMetrics);
        setDerivedError(null);
      })
      .catch((err) => {
        setDerivedError(err instanceof Error ? err.message : "Failed to load derived metrics");
        // Fallback to calculated values if API fails
        if (summary && !summaryLoading) {
          const bySeverity = summary.summary.by_severity || {};
          const critical = bySeverity.critical || 0;
          setDerived({
            critical_records: critical,
            duplicate_rate: 0,
            link_health: 100,
            data_completeness: 100,
            base_health: 100,
            total_records: 0,
          });
        }
      })
      .finally(() => {
        setDerivedLoading(false);
      });
  }, [summary, summaryLoading]);

  // Load flagged rules from API
  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || window.location.origin;
    setFlaggedRulesLoading(true);
    
    fetch(`${API_BASE}/integrity/metrics/flagged-rules`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setFlaggedRules(data.flagged_rules || []);
        setFlaggedRulesError(null);
      })
      .catch((err) => {
        setFlaggedRulesError(err instanceof Error ? err.message : "Failed to load flagged rules");
        setFlaggedRules([]);
      })
      .finally(() => {
        setFlaggedRulesLoading(false);
      });
  }, []);

  // Load KPI data from API
  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || window.location.origin;
    setKpiLoading(true);
    
    fetch(`${API_BASE}/integrity/metrics/kpi?weeks=8`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setKpiData(data);
        setKpiError(null);
      })
      .catch((err) => {
        setKpiError(err instanceof Error ? err.message : "Failed to load KPI data");
        setKpiData(null);
      })
      .finally(() => {
        setKpiLoading(false);
      });
  }, []);

  return {
    summary: {
      data: summary,
      error: summaryError,
      loading: summaryLoading,
    },
    runs: {
      data: runsHook.data,
      error: runsHook.error,
      loading: runsHook.loading,
    },
    trends: {
      data: trends,
      error: metricsError,
      loading: metricsLoading,
    },
    queues: {
      data: queues,
      error: queuesError,
      loading: queuesLoading,
    },
    derived: {
      data: derived,
      error: derivedError,
      loading: derivedLoading,
    },
    flaggedRules: {
      data: flaggedRules,
      error: flaggedRulesError,
      loading: flaggedRulesLoading,
    },
    kpi: {
      data: kpiData,
      error: kpiError,
      loading: kpiLoading,
    },
  };
}

