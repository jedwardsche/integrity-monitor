import { useState } from "react";
import { useFirestoreRuns } from "../hooks/useFirestoreRuns";
import { useFirestoreMetrics } from "../hooks/useFirestoreMetrics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { RunDetailModal } from "../components/RunDetailModal";
import type { RunHistoryItem } from "../hooks/useFirestoreRuns";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  window.location.origin;

export function ReportsPage() {
  const { data: runs, loading, error } = useFirestoreRuns(50);
  const { trends, loading: trendsLoading, error: trendsError } = useFirestoreMetrics(7);
  const [downloading, setDownloading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RunHistoryItem | null>(null);

  const handleDownloadParams = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem("auth_token"); // Simple auth for now
      const response = await fetch(`${API_BASE}/integrity/export/params`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `integrity-params-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to download report");
    } finally {
      setDownloading(false);
    }
  };

  // Get all unique issue types from the trend data to create lines
  const issueTypes = Array.from(
    new Set(
      trends.flatMap((item) =>
        Object.keys(item).filter((key) => key !== "day")
      )
    )
  );

  // Color map for known issue types
  const colorMap: Record<string, string> = {
    duplicate: "#ef4444", // red
    missing_link: "#3b82f6", // blue
    attendance: "#8b5cf6", // purple
    missing_field: "#10b981", // green
    unknown: "#6b7280", // gray
  };

  // Function to get color for a type (fallback to hash or gray if not known)
  const getColor = (type: string) => {
    if (colorMap[type]) return colorMap[type];
    // Simple hash for consistent colors for unknown types
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - c.length) + c;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            View run history and export data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadParams}
            disabled={downloading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {downloading ? "Downloading..." : "Export Parameters"}
          </button>
        </div>
      </div>

      {/* Trend Graph */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          7-Day Issue Trend
        </h2>
        
        {trendsLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : trendsError ? (
          <div className="h-64 flex items-center justify-center text-red-500">
            Error loading trend data: {trendsError}
          </div>
        ) : trends.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No trend data available for the last 7 days.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trends}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.375rem",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                />
                <Legend />
                {issueTypes.map((type) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    name={type.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())} // Title Case
                    stroke={getColor(type)}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Run History Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Run History
          </h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            Loading history...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            Error: {error}
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No run history available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Duration
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Issues Found
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Trigger
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runs.map((run) => (
                  <tr 
                    key={run.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedRun(run)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {run.started_at?.toDate
                        ? run.started_at.toDate().toLocaleString()
                        : new Date().toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.duration_ms
                        ? `${(run.duration_ms / 1000).toFixed(1)}s`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.anomalies_found}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          run.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : run.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.trigger_source || "manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  );
}
