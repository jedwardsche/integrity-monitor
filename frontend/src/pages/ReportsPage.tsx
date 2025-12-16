import { useNavigate } from "react-router-dom";
import { useFirestoreRuns } from "../hooks/useFirestoreRuns";
import { RunDetailModal } from "../components/RunDetailModal";
import { useState } from "react";
import type { RunHistoryItem } from "../hooks/useFirestoreRuns";
import { useAuth } from "../hooks/useAuth";
import { generateRunReport } from "../services/pdfReportService";

import { API_BASE } from "../config/api";

export function ReportsPage() {
  const navigate = useNavigate();
  const { data: runs, loading, error } = useFirestoreRuns(50);
  const [selectedRun, setSelectedRun] = useState<RunHistoryItem | null>(null);
  const { getToken } = useAuth();
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
      case "success":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
      case "canceled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const handleDownloadPDF = async (
    run: RunHistoryItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    const isRunning = run.status.toLowerCase() === "running" || !run.ended_at;
    if (isRunning) {
      return;
    }

    if (downloadingRunId) return;

    setDownloadingRunId(run.id);

    try {
      const blob = await generateRunReport(run);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const runDate =
        run.started_at?.toDate?.() || run.ended_at?.toDate?.() || new Date();
      const dateStr =
        runDate instanceof Date
          ? runDate.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];
      const runId = (run.run_id || run.id).substring(0, 8);

      link.download = `integrity-report-${runId}-${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF report. Please try again.");
    } finally {
      setDownloadingRunId(null);
    }
  };

  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateTrendReport = async () => {
    setGeneratingReport("trend");
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE}/integrity/metrics/trends?days=7`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!response.ok) throw new Error("Failed to fetch trend data");
      const data = await response.json();
      const filename = `trend-report-7day-${
        new Date().toISOString().split("T")[0]
      }.json`;
      downloadJSON(data, filename);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to generate trend report"
      );
    } finally {
      setGeneratingReport(null);
    }
  };

  const generateDashboardReport = async () => {
    setGeneratingReport("dashboard");
    try {
      const token = await getToken();
      const [
        summaryRes,
        trendsRes,
        queuesRes,
        derivedRes,
        runsRes,
        flaggedRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/integrity/metrics/summary`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${API_BASE}/integrity/metrics/trends?days=7`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${API_BASE}/integrity/metrics/queues`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${API_BASE}/integrity/metrics/derived`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${API_BASE}/integrity/metrics/runs?limit=50`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${API_BASE}/integrity/metrics/flagged-rules`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
      ]);

      if (
        !summaryRes.ok ||
        !trendsRes.ok ||
        !queuesRes.ok ||
        !derivedRes.ok ||
        !runsRes.ok ||
        !flaggedRes.ok
      ) {
        throw new Error("Failed to fetch dashboard metrics");
      }

      const [summary, trends, queues, derived, runs, flagged] =
        await Promise.all([
          summaryRes.json(),
          trendsRes.json(),
          queuesRes.json(),
          derivedRes.json(),
          runsRes.json(),
          flaggedRes.json(),
        ]);

      const report = {
        generated_at: new Date().toISOString(),
        summary,
        trends,
        queues,
        derived,
        runs,
        flagged_rules: flagged,
      };

      const filename = `dashboard-metrics-report-${
        new Date().toISOString().split("T")[0]
      }.json`;
      downloadJSON(report, filename);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to generate dashboard report"
      );
    } finally {
      setGeneratingReport(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand)] mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--text-main)] hover:bg-[var(--bg-mid)] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold text-[var(--text-main)] mb-2"
            style={{ fontFamily: "Outfit" }}
          >
            Reports
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            View and download integrity scan reports
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateTrendReport}
            disabled={generatingReport !== null}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-mid)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generatingReport === "trend" ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--brand)]"></div>
                Generating...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                7-Day Trend Report
              </>
            )}
          </button>
          <button
            onClick={generateDashboardReport}
            disabled={generatingReport !== null}
            className="rounded-lg border border-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generatingReport === "dashboard" ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--brand)]"></div>
                Generating...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Full Dashboard Report
              </>
            )}
          </button>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)]">No reports available yet.</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Run a scan to generate your first report.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-mid)] text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Issues</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-t border-[var(--border)]/70 hover:bg-[var(--bg-mid)]/30 cursor-pointer"
                  onClick={() => setSelectedRun(run)}
                >
                  <td className="px-4 py-3">{run.time}</td>
                  <td className="px-4 py-3">{run.trigger}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        run.status
                      )}`}
                    >
                      {(() => {
                        const statusLower = (run.status || "").toLowerCase();
                        if (
                          statusLower === "cancelled" ||
                          statusLower === "canceled"
                        ) {
                          return "Cancelled";
                        }
                        return run.status;
                      })()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {run.anomalies.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {run.duration}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={(e) => handleDownloadPDF(run, e)}
                        disabled={
                          downloadingRunId === run.id ||
                          run.status.toLowerCase() === "running" ||
                          !run.ended_at
                        }
                        className="p-1.5 rounded hover:bg-[var(--bg-mid)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          run.status.toLowerCase() === "running" ||
                          !run.ended_at
                            ? "Cannot download running scans"
                            : "Download PDF Report"
                        }
                      >
                        {downloadingRunId === run.id ? (
                          <div className="w-4 h-4 border-2 border-[var(--cta-blue)] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 -960 960 960"
                            className="w-4 h-4"
                            fill="currentColor"
                          >
                            <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (run.run_id) {
                            navigate(`/run/${run.run_id}`);
                          }
                        }}
                        className="text-xs text-[var(--cta-blue)] hover:underline"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  );
}
