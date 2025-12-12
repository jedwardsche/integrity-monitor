import React, { useMemo } from 'react';
import { useIntegrityMetrics } from '../hooks/useIntegrityMetrics';
import type { RunHistoryItem } from '../hooks/useFirestoreRuns';
import { IssueList } from './IssueList';
import { getDataIssuesLink } from '../utils/airtable';

type DashboardContentProps = {
  integrityMetrics: ReturnType<typeof useIntegrityMetrics>;
  onRunScan: () => void;
  runScanLoading: boolean;
  selectedQueue: { type?: string; entity?: string } | null;
  onSelectQueue: (queue: { type?: string; entity?: string } | null) => void;
  onCloseQueue: () => void;
  selectedRun: RunHistoryItem | null;
  onSelectRun: (run: RunHistoryItem | null) => void;
  onCloseRun: () => void;
};

export function DashboardContent({
  integrityMetrics,
  selectedQueue,
  onSelectQueue,
  onCloseQueue,
  onSelectRun,
}: DashboardContentProps) {
  const { summary, runs, trends, queues, derived, flaggedRules, kpi } =
    integrityMetrics;

  // Map queue titles to filter types
  const getQueueFilter = (
    title: string
  ): { type?: string; entity?: string } | null => {
    const mapping: Record<string, { type?: string; entity?: string }> = {
      "Duplicate Records": { type: "duplicate" },
      "Missing Links": { type: "missing_link" },
      "Attendance Anomalies": { type: "attendance" },
      "Missing Fields": { type: "missing_field" },
    };
    return mapping[title] || null;
  };

  // Calculate summary cards from real data
  const summaryCards = useMemo(() => {
    const totalIssues = summary.data?.summary?.total || 0;
    const bySeverity = summary.data?.summary?.by_severity || {};
    const criticalCount =
      derived.data?.critical_records || bySeverity.critical || 0;
    const lastRun = summary.data?.last_run;

    let lastRunTime = "Never";
    let lastRunBadge = "No runs yet";
    let lastRunContext = "Run integrity check to start";

    if (lastRun && summary.data?.last_run_time) {
      const runDate = new Date(summary.data.last_run_time);
      lastRunTime = runDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      lastRunBadge =
        summary.data.last_run?.mode === "full" ? "Weekly" : "Nightly";
      const duration = summary.data.last_run_duration;
      if (duration) {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        lastRunContext = `Duration ${minutes}m ${seconds}s`;
      }
    }

    return [
      {
        label: "Open Issues",
        value: totalIssues.toString(),
        badge:
          totalIssues > 0
            ? `${bySeverity.critical || 0} critical`
            : "All clear",
        context: "Duplicates, broken links, attendance",
      },
      {
        label: "Data Completeness",
        value: `${derived.data?.data_completeness?.toFixed(0) || 100}%`,
        badge: `${derived.data?.link_health?.toFixed(0) || 100}% link health`,
        context: "Required fields coverage",
      },
      {
        label: "Critical records",
        value: criticalCount.toString(),
        badge: criticalCount > 0 ? "Needs outreach" : "None",
        context: "Attendance + billing gaps",
      },
      {
        label: "Last run",
        value: lastRunTime,
        badge: lastRunBadge,
        context: lastRunContext,
      },
    ];
  }, [summary, derived]);

  // Use real issue queues or empty array
  const issueQueues = queues.data || [];

  // Use real run history or empty array
  const runHistory = runs.data || [];

  // Use real trend data or empty array
  const trendData = trends.data || [];

  // Memoize trend chart calculations to avoid re-computing on every render
  const trendChartData = useMemo(() => {
    if (trendData.length === 0) return null;

    const maxValue = Math.max(
      ...trendData.flatMap((d) => [
        d.duplicates || 0,
        d.links || 0,
        d.attendance || 0,
      ]),
      1
    );
    const scale = 120 / maxValue; // Max height is 120px

    return trendData.map((day) => ({
      day: day.day,
      duplicatesHeight: Math.max(2, (day.duplicates || 0) * scale),
      linksHeight: Math.max(2, (day.links || 0) * scale),
      attendanceHeight: Math.max(2, (day.attendance || 0) * scale),
    }));
  }, [trendData]);

  // Calculate severity breakdown
  const bySeverity = summary.data?.summary?.by_severity || {};
  const severityCounts = {
    critical: bySeverity.critical || 0,
    warning: bySeverity.warning || 0,
    info: bySeverity.info || 0,
  };
  const totalSeverity =
    severityCounts.critical + severityCounts.warning + severityCounts.info;

  return (
    <>
      <section className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="flex-1 rounded-3xl border border-[var(--border)] bg-[var(--bg-light)] p-6 shadow-[0_30px_60px_rgba(31,79,72,0.08)]">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Mission
          </p>
          <h1
            className="mt-3 text-3xl font-semibold text-[var(--text-main)]"
            style={{ fontFamily: "Outfit" }}
          >
            90% of anomalies caught before families notice.
          </h1>
          <p className="mt-3 text-[var(--text-muted)]">
            Airtable is our source of truth. The monitor reviews Students,
            Parents, Contractors, Classes, Attendance, and Payments nightly plus
            weekly deep dives to surface duplicates, missing links, and
            attendance risk.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4"
              >
                <p className="text-sm text-[var(--text-muted)]">{card.label}</p>
                <p
                  className="mt-2 text-3xl font-semibold"
                  style={{ fontFamily: "Outfit" }}
                >
                  {card.value}
                </p>
                <p className="text-sm text-[var(--brand)] font-medium">
                  {card.badge}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {card.context}
                </p>
              </div>
            ))}
          </div>
          {kpi.data && kpi.data.latest && (
            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-[var(--text-muted)]">
                  KPI Measurement
                </p>
                {kpi.data.latest.kpi_percent >= 90 ? (
                  <span className="rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold">
                    On Target
                  </span>
                ) : (
                  <span className="rounded-full bg-[#ffecc7] text-[#b35300] px-2 py-1 text-xs font-semibold">
                    Below Target
                  </span>
                )}
              </div>
              <p
                className="text-3xl font-semibold"
                style={{ fontFamily: "Outfit" }}
              >
                {kpi.data.latest.kpi_percent?.toFixed(1) || "0.0"}%
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Target: 90%+ • Last measured:{" "}
                {kpi.data.latest.measured_at
                  ? new Date(kpi.data.latest.measured_at).toLocaleDateString()
                  : "Never"}
              </p>
              {kpi.data.alerts && kpi.data.alerts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {kpi.data.alerts.map((alert: any, idx: number) => (
                    <p key={idx} className="text-xs text-[var(--text-muted)]">
                      ⚠️ {alert.message}
                    </p>
                  ))}
                </div>
              )}
              {kpi.data.trend && kpi.data.trend.length > 1 && (
                <div className="mt-4">
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    8-week trend
                  </p>
                  <div className="flex items-end gap-1 h-16">
                    {kpi.data.trend.slice(-8).map((point: any, idx: number) => {
                      const height = Math.max(
                        4,
                        (point.kpi_percent / 100) * 64
                      );
                      return (
                        <div
                          key={idx}
                          className="flex-1 rounded-t bg-[var(--brand)]"
                          style={{ height: `${height}px` }}
                          title={`${point.week_id}: ${point.kpi_percent}%`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_30px_60px_rgba(31,79,72,0.08)]">
          <p className="text-sm text-[var(--text-muted)]">
            Run Schedule
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-main)]">
                Nightly Incremental
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                02:00 AM · Changed records only
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-main)]">
                Weekly Full Scan
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Sunday 03:00 AM · All records
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-main)]">
                KPI Measurement
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Sunday 04:00 AM · Sample validation
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/80 px-4 py-3 text-xs text-[var(--text-muted)]">
            Alerts sent to Slack + email on failures or threshold breaches.
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Trend
              </p>
              <p className="text-lg font-semibold text-[var(--text-main)]">
                Last 7 runs
              </p>
            </div>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--text-muted)]">
              On target
            </span>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-3">
            {trendChartData ? (
              trendChartData.map((day) => (
                <div key={day.day} className="space-y-2">
                  <div className="flex h-32 flex-col justify-end gap-1 rounded-2xl bg-[var(--bg-mid)]/70 p-1">
                    <div
                      className="rounded-full bg-[#3E716A]"
                      style={{
                        height: `${day.duplicatesHeight}px`,
                      }}
                    />
                    <div
                      className="rounded-full bg-[#6B9A94]"
                      style={{
                        height: `${day.linksHeight}px`,
                      }}
                    />
                    <div
                      className="rounded-full bg-[#3566A8]"
                      style={{
                        height: `${day.attendanceHeight}px`,
                      }}
                    />
                  </div>
                  <p className="text-center text-xs text-[var(--text-muted)]">
                    {day.day}
                  </p>
                </div>
              ))
            ) : (
              <div className="col-span-7 text-center text-sm text-[var(--text-muted)] py-8">
                {trends.loading
                  ? "Loading trend data..."
                  : "No trend data available yet"}
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#3E716A]" />
              Duplicates
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#6B9A94]" />
              Missing links
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#3566A8]" />
              Attendance
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Severity
          </p>
          <div className="mt-4 space-y-3">
            {[
              { label: "Critical", count: severityCounts.critical },
              { label: "Warning", count: severityCounts.warning },
              { label: "Info", count: severityCounts.info },
            ].map((severity, idx) => {
              const percentage =
                totalSeverity > 0
                  ? Math.round((severity.count / totalSeverity) * 100)
                  : 0;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/60 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {severity.label}
                    </p>
                    <p
                      className="text-lg font-semibold text-[var(--text-main)]"
                      style={{ fontFamily: "Outfit" }}
                    >
                      {severity.count}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--text-muted)]">
                    {totalSeverity > 0
                      ? `${percentage}% of issues`
                      : "No issues"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        id="queues"
      >
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Priority queues
              </p>
              <p className="text-lg font-semibold text-[var(--text-main)]">
                Guided fixes
              </p>
            </div>
            <a
              href={getDataIssuesLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--cta-blue)] hover:underline"
            >
              Open in Airtable →
            </a>
          </div>
          {selectedQueue ? (
            <div className="mt-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-main)]">
                  Issue Details
                </h3>
                <button
                  onClick={onCloseQueue}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  ← Back to queues
                </button>
              </div>
              <IssueList filters={selectedQueue} onClose={onCloseQueue} />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {issueQueues.length > 0 ? (
                issueQueues.map((queue) => {
                  const filter = getQueueFilter(queue.title);
                  return (
                    <li
                      key={queue.title}
                      onClick={() => filter && onSelectQueue(filter)}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4 cursor-pointer hover:bg-[var(--bg-mid)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-[var(--text-main)]">
                            {queue.title}
                          </p>
                          <p className="text-sm text-[var(--text-muted)]">
                            {queue.detail}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[var(--text-main)]">
                            {queue.count}
                          </span>
                          <p className="text-xs text-[var(--text-muted)]">
                            {queue.chip}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="text-center text-sm text-[var(--text-muted)] py-4">
                  {queues.loading
                    ? "Loading issue queues..."
                    : "No issue queues available yet"}
                </li>
              )}
            </ul>
          )}
        </div>

        {flaggedRules.data && flaggedRules.data.length > 0 && (
          <div className="rounded-3xl border border-[var(--border)] bg-white p-6">
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Rule Tuning
              </p>
              <p className="text-lg font-semibold text-[var(--text-main)]">
                Most Ignored Rules
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Rules with &gt;10% ignored issues need review
              </p>
            </div>
            <ul className="space-y-2">
              {flaggedRules.data.slice(0, 5).map((rule) => (
                <li
                  key={rule.rule_id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-mono text-xs text-[var(--text-main)]">
                        {rule.rule_id}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {rule.ignored_count} of {rule.total_count} ignored
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-[#ffecc7] text-[#b35300] px-3 py-1 text-sm font-semibold">
                        {rule.ignored_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {flaggedRules.loading && (
              <div className="text-center text-sm text-[var(--text-muted)] py-4">
                Loading flagged rules...
              </div>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Run log
            </p>
            <p className="text-lg font-semibold">Recent runs</p>
          </div>
          <div className="space-y-3">
            {runHistory.length > 0 ? (
              runHistory.map((run) => (
                <div
                  key={run.id}
                  onClick={() => onSelectRun(run)}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/60 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg-mid)] transition-colors"
                >
                  <p className="font-semibold text-[var(--text-main)]">
                    {run.time}
                  </p>
                  <p className="text-[var(--text-muted)]">
                    {run.trigger} • {run.anomalies} anomalies • {run.status} •{" "}
                    {run.duration}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-[var(--text-muted)] py-4">
                {runs.loading
                  ? "Loading run history..."
                  : "No run history available yet"}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/80 px-4 py-3 text-sm text-[var(--text-muted)]">
            View Cloud Run / Scheduler logs for retry attempts and alert
            receipts.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Issue drill-down
            </p>
            <p className="text-lg font-semibold">Pending anomalies</p>
          </div>
          <a
            href={getDataIssuesLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--cta-blue)] hover:underline"
          >
            View in Airtable →
          </a>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-6">
          <IssueList />
        </div>
      </section>
    </>
  );
}
