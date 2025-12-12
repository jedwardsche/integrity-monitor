import { useNavigate } from "react-router-dom";
import { useFirestoreRuns } from "../hooks/useFirestoreRuns";
import { useState } from "react";
import type { RunHistoryItem } from "../hooks/useFirestoreRuns";

export function RunsPage() {
  const navigate = useNavigate();
  const { data: runs, loading, error } = useFirestoreRuns(100);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
      case "success":
        return "bg-green-100 text-green-800 border-green-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp?.toDate?.() || new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getTriggerLabel = (trigger: string, mode?: string) => {
    if (trigger === "manual") return "Manual";
    if (trigger === "nightly") return "Nightly";
    if (trigger === "weekly") return "Weekly";
    if (mode === "full") return "Full Scan";
    return trigger || "Unknown";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand)] mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading runs...</p>
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
            Runs
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            View status and log details for all integrity scans
          </p>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)]">No runs found.</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Run a scan to generate your first run.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => {
            const isExpanded = expandedRun === run.id;
            const startTime =
              run.started_at?.toDate?.() ||
              new Date(run.started_at || Date.now());
            const endTime = run.ended_at?.toDate?.() || null;
            const isRunning = !endTime || run.status === "running";

            return (
              <div
                key={run.id}
                className="rounded-xl border border-[var(--border)] bg-white overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-[var(--bg-mid)]/30 transition-colors"
                  onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                              run.status
                            )}`}
                          >
                            {run.status}
                          </span>
                          {isRunning && (
                            <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand)] animate-pulse"></span>
                          )}
                          <span className="text-sm text-[var(--text-muted)]">
                            {formatTimestamp(run.started_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
                          <span>
                            Mode: {run.mode === "full" ? "Full" : "Incremental"}
                          </span>
                          <span>
                            Trigger:{" "}
                            {getTriggerLabel(run.trigger || "", run.mode)}
                          </span>
                          <span>Duration: {run.duration}</span>
                          {run.run_id && (
                            <span className="font-mono text-xs">
                              ID: {run.run_id.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (run.run_id) {
                            navigate(`/run/${run.run_id}`);
                          }
                        }}
                        className="text-sm text-[var(--brand)] hover:underline"
                      >
                        View Details
                      </button>
                      <svg
                        className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[var(--border)] bg-[var(--bg-mid)]/20 p-4 space-y-4">
                    {/* Status Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-main)] mb-2">
                        Status Details
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-[var(--text-muted)] text-xs mb-1">
                            Started
                          </div>
                          <div className="text-[var(--text-main)] font-medium">
                            {formatTimestamp(run.started_at)}
                          </div>
                        </div>
                        {endTime && (
                          <div>
                            <div className="text-[var(--text-muted)] text-xs mb-1">
                              Ended
                            </div>
                            <div className="text-[var(--text-main)] font-medium">
                              {formatTimestamp(run.ended_at)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[var(--text-muted)] text-xs mb-1">
                            Duration
                          </div>
                          <div className="text-[var(--text-main)] font-medium">
                            {run.duration_ms
                              ? `${Math.floor(
                                  run.duration_ms / 60000
                                )}m ${Math.floor(
                                  (run.duration_ms % 60000) / 1000
                                )}s`
                              : run.duration}
                          </div>
                        </div>
                        <div>
                          <div className="text-[var(--text-muted)] text-xs mb-1">
                            Run ID
                          </div>
                          <div className="text-[var(--text-main)] font-mono text-xs">
                            {run.run_id || run.id}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Log Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-main)] mb-2">
                        Log Details
                      </h3>
                      <div className="bg-white rounded-lg border border-[var(--border)] p-3 font-mono text-xs">
                        <div className="space-y-1">
                          <div className="text-[var(--text-muted)]">
                            <span className="text-blue-600">[INFO]</span> Run
                            started: {formatTimestamp(run.started_at)}
                          </div>
                          <div className="text-[var(--text-muted)]">
                            <span className="text-blue-600">[INFO]</span> Mode:{" "}
                            {run.mode || "incremental"}
                          </div>
                          <div className="text-[var(--text-muted)]">
                            <span className="text-blue-600">[INFO]</span>{" "}
                            Trigger:{" "}
                            {getTriggerLabel(run.trigger || "", run.mode)}
                          </div>
                          {endTime && (
                            <div className="text-[var(--text-muted)]">
                              <span className="text-green-600">[INFO]</span> Run
                              completed: {formatTimestamp(run.ended_at)}
                            </div>
                          )}
                          {run.status === "error" && (
                            <div className="text-red-600">
                              <span className="text-red-600">[ERROR]</span> Run
                              failed
                            </div>
                          )}
                          {run.status === "warning" && (
                            <div className="text-yellow-600">
                              <span className="text-yellow-600">[WARN]</span>{" "}
                              Run completed with warnings
                            </div>
                          )}
                          {run.status === "success" ||
                          run.status === "Healthy" ? (
                            <div className="text-green-600">
                              <span className="text-green-600">[SUCCESS]</span>{" "}
                              Run completed successfully
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
