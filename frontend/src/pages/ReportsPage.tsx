import { useNavigate } from "react-router-dom";
import { useFirestoreRuns } from "../hooks/useFirestoreRuns";
import { RunDetailModal } from "../components/RunDetailModal";
import { useState } from "react";
import type { RunHistoryItem } from "../hooks/useFirestoreRuns";

export function ReportsPage() {
  const navigate = useNavigate();
  const { data: runs, loading, error } = useFirestoreRuns(50);
  const [selectedRun, setSelectedRun] = useState<RunHistoryItem | null>(null);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
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
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {run.anomalies.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {run.duration}
                  </td>
                  <td className="px-4 py-3 text-right">
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
