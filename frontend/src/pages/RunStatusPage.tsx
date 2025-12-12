import { useParams, useNavigate } from "react-router-dom";
import { useRunStatus } from "../hooks/useRunStatus";
import { RunDetailModal } from "../components/RunDetailModal";
import type { RunHistoryItem } from "../hooks/useFirestoreRuns";

export function RunStatusPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { runStatus, loading, error } = useRunStatus(runId || null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand)] mb-4"></div>
          <p className="text-[var(--text-muted)] mb-2">Loading run status...</p>
          <p className="text-xs text-[var(--text-muted)]">
            {runId
              ? `Run ID: ${runId.substring(0, 8)}...`
              : "Waiting for run to initialize"}
          </p>
        </div>
      </div>
    );
  }

  if (error || !runStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-2 font-medium">
            {error || "Run not found"}
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            The run may still be initializing. Check the Runs page to see if it
            appears there.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate("/runs")}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--text-main)] hover:bg-[var(--bg-mid)] transition-colors"
            >
              View Runs
            </button>
            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--text-main)] hover:bg-[var(--bg-mid)] transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = runStatus.status === "running" || !runStatus.ended_at;
  const startTime =
    runStatus.started_at?.toDate?.() ||
    new Date(runStatus.started_at || Date.now());
  const endTime = runStatus.ended_at?.toDate?.() || null;
  const elapsed = endTime
    ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
    : Math.floor((Date.now() - startTime.getTime()) / 1000);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "success":
        return "Completed";
      case "error":
        return "Failed";
      case "warning":
        return "Completed with Warnings";
      default:
        return "Running";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold text-[var(--text-main)] mb-2"
            style={{ fontFamily: "Outfit" }}
          >
            Run Status
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Run ID: {runStatus.id}
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--text-main)] hover:bg-[var(--bg-mid)] transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Status Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isRunning && (
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--brand)]"></div>
            )}
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                runStatus.status
              )}`}
            >
              {getStatusLabel(runStatus.status)}
            </span>
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            {startTime.toLocaleString()}
          </div>
        </div>

        {/* Progress Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Mode</div>
            <div className="font-medium text-[var(--text-main)]">
              {runStatus.mode === "full" ? "Full Scan" : "Incremental"}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Trigger</div>
            <div className="font-medium text-[var(--text-main)]">
              {runStatus.trigger === "manual"
                ? "Manual"
                : runStatus.trigger === "nightly"
                ? "Nightly"
                : runStatus.trigger === "weekly"
                ? "Weekly"
                : runStatus.trigger || "Unknown"}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">
              Duration
            </div>
            <div className="font-medium text-[var(--text-main)]">
              {formatDuration(elapsed)}
            </div>
          </div>
        </div>

        {/* Entity Counts */}
        {runStatus.entity_counts &&
          Object.keys(runStatus.entity_counts).length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-medium text-[var(--text-main)] mb-3">
                Records Processed
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(runStatus.entity_counts).map(
                  ([entity, count]) => (
                    <div
                      key={entity}
                      className="rounded-lg border border-[var(--border)] p-3 bg-[var(--bg-mid)]/30"
                    >
                      <div className="text-xs text-[var(--text-muted)] mb-1 capitalize">
                        {entity}
                      </div>
                      <div className="text-lg font-semibold text-[var(--text-main)]">
                        {count.toLocaleString()}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        {/* Issue Counts */}
        {runStatus.counts && (
          <div className="mb-6">
            <div className="text-sm font-medium text-[var(--text-main)] mb-3">
              Issues Found
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg-mid)]/30">
                <div className="text-xs text-[var(--text-muted)] mb-1">
                  Total
                </div>
                <div className="text-2xl font-semibold text-[var(--text-main)]">
                  {runStatus.counts.total || 0}
                </div>
              </div>
              {runStatus.counts.by_severity && (
                <>
                  <div className="rounded-lg border border-red-200 p-4 bg-red-50">
                    <div className="text-xs text-red-700 mb-1">Critical</div>
                    <div className="text-2xl font-semibold text-red-800">
                      {runStatus.counts.by_severity.critical || 0}
                    </div>
                  </div>
                  <div className="rounded-lg border border-yellow-200 p-4 bg-yellow-50">
                    <div className="text-xs text-yellow-700 mb-1">Warning</div>
                    <div className="text-2xl font-semibold text-yellow-800">
                      {runStatus.counts.by_severity.warning || 0}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {runStatus.error_message && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4">
            <div className="text-sm font-medium text-red-800 mb-2">Error</div>
            <div className="text-sm text-red-700">
              {runStatus.error_message}
            </div>
          </div>
        )}

        {/* Failed Checks */}
        {runStatus.failed_checks && runStatus.failed_checks.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="text-sm font-medium text-yellow-800 mb-2">
              Failed Checks
            </div>
            <div className="text-sm text-yellow-700">
              {runStatus.failed_checks.join(", ")}
            </div>
          </div>
        )}

        {/* Timing Breakdown */}
        {(runStatus.duration_fetch ||
          runStatus.duration_checks ||
          runStatus.duration_write_airtable ||
          runStatus.duration_write_firestore) && (
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <div className="text-sm font-medium text-[var(--text-main)] mb-3">
              Timing Breakdown
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {runStatus.duration_fetch && (
                <div>
                  <div className="text-[var(--text-muted)]">Fetch</div>
                  <div className="font-medium text-[var(--text-main)]">
                    {(runStatus.duration_fetch / 1000).toFixed(1)}s
                  </div>
                </div>
              )}
              {runStatus.duration_checks && (
                <div>
                  <div className="text-[var(--text-muted)]">Checks</div>
                  <div className="font-medium text-[var(--text-main)]">
                    {(runStatus.duration_checks / 1000).toFixed(1)}s
                  </div>
                </div>
              )}
              {runStatus.duration_write_airtable && (
                <div>
                  <div className="text-[var(--text-muted)]">Write Airtable</div>
                  <div className="font-medium text-[var(--text-main)]">
                    {(runStatus.duration_write_airtable / 1000).toFixed(1)}s
                  </div>
                </div>
              )}
              {runStatus.duration_write_firestore && (
                <div>
                  <div className="text-[var(--text-muted)]">
                    Write Firestore
                  </div>
                  <div className="font-medium text-[var(--text-main)]">
                    {(runStatus.duration_write_firestore / 1000).toFixed(1)}s
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Auto-refresh indicator for running scans */}
      {isRunning && (
        <div className="text-center text-sm text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand)] animate-pulse"></span>
            Live updates enabled
          </span>
        </div>
      )}
    </div>
  );
}
