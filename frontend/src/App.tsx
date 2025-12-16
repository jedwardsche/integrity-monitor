import { useState, useEffect, useMemo, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./App.css";
import { ProfileMenu } from "./components/ProfileMenu";
import { ScanConfigModal, type ScanConfig } from "./components/ScanConfigModal";
import { useAuth } from "./hooks/useAuth";
import { useRunStatus } from "./hooks/useRunStatus";
import { useFirestoreRuns } from "./hooks/useFirestoreRuns";
import { ToastContainer } from "./components/Toast";
import databaseSearchIcon from "./assets/database_search.svg";
import scanDocumentIcon from "./assets/scan_document.svg";

import { API_BASE } from "./config/api";

interface AppProps {
  children: ReactNode;
}

export default function App({ children }: AppProps) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { data: runs, loading: runsLoading } = useFirestoreRuns(1);

  // Toast notification state
  const [toasts, setToasts] = useState<
    Array<{ id: string; message: string; type: "success" | "error" | "info" }>
  >([]);
  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Run scan state
  const [runScanLoading, setRunScanLoading] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [scanConfigOpen, setScanConfigOpen] = useState(false);
  const MIN_SCAN_INTERVAL = 30000; // 30 seconds

  // Monitor current run status
  const { runStatus } = useRunStatus(currentRunId);

  // Clear current run ID when run completes
  useEffect(() => {
    if (runStatus && runStatus.status !== "running" && runStatus.ended_at) {
      // Run has completed, but keep the ID for a bit so user can still navigate
      // Clear it after 30 seconds
      const timer = setTimeout(() => {
        setCurrentRunId(null);
        setRunScanLoading(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [runStatus]);

  // Update loading state based on run status
  useEffect(() => {
    if (runStatus) {
      if (runStatus.status === "running" || !runStatus.ended_at) {
        setRunScanLoading(true);
      } else {
        setRunScanLoading(false);
      }
    }
  }, [runStatus]);

  // Handle run scan button click - opens configuration modal
  const handleRunScanClick = () => {
    // Check rate limiting
    const now = Date.now();
    if (lastScanTime && now - lastScanTime < MIN_SCAN_INTERVAL) {
      const remainingSeconds = Math.ceil(
        (MIN_SCAN_INTERVAL - (now - lastScanTime)) / 1000
      );
      addToast(
        `Please wait ${remainingSeconds} seconds before running another scan`,
        "info"
      );
      return;
    }
    setScanConfigOpen(true);
  };

  // Execute scan with configuration
  const executeScan = async (config: ScanConfig) => {
    setScanConfigOpen(false);
    setRunScanLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        addToast("Authentication required. Please sign in.", "error");
        setRunScanLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({
        mode: config.mode,
        trigger: "manual",
      });

      // Add entities if specified
      if (config.entities && config.entities.length > 0) {
        config.entities.forEach((entity) => {
          params.append("entities", entity);
        });
      }

      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "App.tsx:107",
            message: "Before fetch request",
            data: {
              url: `${API_BASE}/integrity/run?${params.toString()}`,
              hasToken: !!token,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "fetch-attempt",
            hypothesisId: "C",
          }),
        }
      ).catch(() => {});
      // #endregion agent log

      const response = await fetch(
        `${API_BASE}/integrity/run?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      ).catch((error) => {
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "App.tsx:117",
              message: "Fetch error caught",
              data: {
                error: error.message,
                errorType: error.name,
                errorStack: error.stack,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "fetch-attempt",
              hypothesisId: "C",
            }),
          }
        ).catch(() => {});
        // #endregion agent log
        throw error;
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || `Request failed with status ${response.status}`
        );
      }

      const result = await response.json();
      const runId = result.run_id;

      console.log("[App] Scan started, response:", result);
      console.log("[App] Run ID:", runId);

      if (runId) {
        setCurrentRunId(runId);
        addToast("Integrity scan started successfully", "success");
        // Navigate to status page after a short delay to allow document creation
        setTimeout(() => {
          console.log("[App] Navigating to run status page:", `/run/${runId}`);
          navigate(`/run/${runId}`);
        }, 1000);
      } else {
        console.warn("[App] No run_id in response:", result);
        addToast("Integrity scan started successfully", "success");
      }

      setLastScanTime(Date.now());
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Failed to start integrity scan",
        "error"
      );
      setRunScanLoading(false);
    }
  };

  // Handle clicking on Running button
  const handleRunningClick = () => {
    // Use lastRunInfo.runId if available (same as the working "Last run" button)
    // Otherwise fall back to currentRunId
    const runId = lastRunInfo?.runId || currentRunId;
    if (runId) {
      navigate(`/run/${runId}`);
    }
  };

  // Get last run info for status display
  const lastRunInfo = useMemo(() => {
    if (runsLoading || !runs || runs.length === 0) {
      return null;
    }

    const lastRun = runs[0];
    const runTime =
      lastRun.started_at?.toDate?.() || lastRun.ended_at?.toDate?.() || null;

    if (!runTime) {
      return null;
    }

    const now = new Date();
    const diffMs = now.getTime() - runTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    let timeDisplay: string;
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      timeDisplay = diffMins < 1 ? "Just now" : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      timeDisplay = `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      timeDisplay = `${Math.floor(diffDays)}d ago`;
    } else {
      // Show date and time for older runs
      timeDisplay =
        runTime.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }) +
        " " +
        runTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
    }

    // Map status to display text and color
    const statusText = lastRun.status || "Unknown";
    const statusLower = statusText.toLowerCase();

    // Format status text for display
    let displayStatus = statusText;
    if (statusLower === "cancelled" || statusLower === "canceled") {
      displayStatus = "Cancelled";
    } else if (statusLower === "healthy") {
      displayStatus = "Healthy";
    } else if (statusLower === "success") {
      displayStatus = "Success";
    } else if (statusLower === "error") {
      displayStatus = "Error";
    } else if (statusLower === "warning") {
      displayStatus = "Warning";
    } else if (statusLower === "running") {
      displayStatus = "Running";
    }

    const statusColor =
      statusLower === "error"
        ? "bg-red-500"
        : statusLower === "warning"
        ? "bg-yellow-500"
        : statusLower === "running"
        ? "bg-blue-500"
        : statusLower === "cancelled" || statusLower === "canceled"
        ? "bg-gray-500"
        : statusLower === "success" || statusLower === "healthy"
        ? "bg-[var(--brand)]"
        : "bg-[var(--brand)]";

    return {
      time: timeDisplay,
      status: displayStatus,
      statusColor,
      runId: lastRun.run_id || lastRun.id,
    };
  }, [runs, runsLoading]);
  return (
    <div className="min-h-screen bg-[var(--bg-warm-light)] text-[var(--text-main)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-light)]/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand)]">
                <img
                  src={databaseSearchIcon}
                  alt="Database Search"
                  className="w-6 h-6 brightness-0 invert"
                />
              </div>
              <div>
                <p
                  className="font-semibold tracking-tight"
                  style={{ fontFamily: "Outfit" }}
                >
                  Data Integrity Monitor
                </p>
              </div>
            </div>
            <nav className="ml-4">
              <div className="inline-flex rounded-full border border-[var(--border)] bg-white/80 p-1 text-sm">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `rounded-full px-4 py-1.5 font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/runs"
                  className={({ isActive }) =>
                    `rounded-full px-4 py-1.5 font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`
                  }
                >
                  Runs
                </NavLink>
                <NavLink
                  to="/schema"
                  className={({ isActive }) =>
                    `rounded-full px-4 py-1.5 font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--brand)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`
                  }
                >
                  Airtable Schema
                </NavLink>
              </div>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
            {runsLoading ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-3 py-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--border)] animate-pulse" />
                Loading...
              </div>
            ) : lastRunInfo ? (
              <button
                onClick={() => navigate(`/run/${lastRunInfo.runId}`)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 hover:bg-white/90 transition-colors cursor-pointer"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${lastRunInfo.statusColor}`}
                />
                Last run {lastRunInfo.time} • {lastRunInfo.status}
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-3 py-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--border)]" />
                No runs yet
              </div>
            )}
            <div className="flex gap-2 items-center">
              {runScanLoading && currentRunId ? (
                <button
                  onClick={handleRunningClick}
                  className="rounded-full border border-[var(--brand)] px-4 py-1.5 text-[var(--brand)] font-medium hover:bg-[var(--brand)]/5 transition-colors flex items-center gap-2"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--brand)] animate-pulse"></span>
                  Running...
                </button>
              ) : (
                <button
                  onClick={handleRunScanClick}
                  disabled={runScanLoading}
                  className="rounded-full border border-[var(--brand)] px-4 py-1.5 text-[var(--brand)] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--brand)]/5 transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 -960 960 960"
                    className="w-4 h-4 flex-shrink-0"
                    fill="currentColor"
                  >
                    <path d="M240-80q-33 0-56.5-23.5T160-160v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-80H240Zm-80-440v-280q0-33 23.5-56.5T240-880h320l240 240v120h-80v-80H520v-200H240v280h-80ZM40-360v-80h880v80H40Zm440-160Zm0 240Z" />
                  </svg>
                  {runScanLoading ? "Starting..." : "Run scan"}
                </button>
              )}
              <NavLink
                to="/reports"
                className={({ isActive }) =>
                  `rounded-full border border-[var(--border)] px-4 py-1.5 font-medium text-[var(--text-main)] hover:bg-[var(--bg-mid)] transition-colors ${
                    isActive ? "bg-[var(--bg-mid)]" : ""
                  }`
                }
              >
                Reports
              </NavLink>
              <ProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {children}
      </main>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Scan configuration modal */}
      <ScanConfigModal
        isOpen={scanConfigOpen}
        onConfirm={executeScan}
        onCancel={() => setScanConfigOpen(false)}
      />
    </div>
  );
}
