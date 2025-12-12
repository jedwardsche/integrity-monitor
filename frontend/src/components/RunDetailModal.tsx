import type { RunHistoryItem } from "../hooks/useFirestoreRuns";

interface RunDetailModalProps {
  run: RunHistoryItem | null;
  onClose: () => void;
}

export function RunDetailModal({ run, onClose }: RunDetailModalProps) {
  if (!run) return null;

  const counts = run.counts || {};
  const byType = counts.by_type || {};
  const bySeverity = counts.by_severity || {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-2xl font-semibold text-[var(--text-main)]"
            style={{ fontFamily: "Outfit" }}
          >
            Run Details
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Run ID</p>
              <p className="font-mono text-sm text-[var(--text-main)]">
                {run.run_id || run.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Status</p>
              <p className="text-sm font-medium text-[var(--text-main)]">
                {run.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Trigger</p>
              <p className="text-sm text-[var(--text-main)]">{run.trigger}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)]">Duration</p>
              <p className="text-sm text-[var(--text-main)]">{run.duration}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--text-main)] mb-2">
              Issue Counts by Type
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-mid)]/60 p-2">
                <p className="text-xs text-[var(--text-muted)]">Duplicates</p>
                <p className="text-lg font-semibold">{byType.duplicate || 0}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-mid)]/60 p-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Missing Links
                </p>
                <p className="text-lg font-semibold">
                  {byType.missing_link || 0}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-mid)]/60 p-2">
                <p className="text-xs text-[var(--text-muted)]">Attendance</p>
                <p className="text-lg font-semibold">
                  {byType.attendance || 0}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--text-main)] mb-2">
              Severity Breakdown
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-mid)]/60 px-3 py-2">
                <span className="text-sm text-[var(--text-muted)]">
                  Critical
                </span>
                <span className="font-semibold text-red-700">
                  {bySeverity.critical || 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-mid)]/60 px-3 py-2">
                <span className="text-sm text-[var(--text-muted)]">
                  Warning
                </span>
                <span className="font-semibold text-yellow-700">
                  {bySeverity.warning || 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-mid)]/60 px-3 py-2">
                <span className="text-sm text-[var(--text-muted)]">Info</span>
                <span className="font-semibold text-blue-700">
                  {bySeverity.info || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            <button
              onClick={onClose}
              className="w-full rounded-full border border-[var(--border)] px-4 py-2 font-medium text-[var(--text-main)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
