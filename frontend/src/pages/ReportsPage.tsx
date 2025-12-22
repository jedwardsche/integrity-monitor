import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useFirestoreRuns } from "../hooks/useFirestoreRuns";
import { useFirestoreMetrics } from "../hooks/useFirestoreMetrics";
import { useIntegrityMetrics } from "../hooks/useIntegrityMetrics";
import { IssueTrendChart } from "../components/IssueTrendChart";
import { generateRunReport } from "../services/pdfReportService";
import { chartToImage } from "../utils/chartToImage";
import jsPDF from "jspdf";
import type { RunHistoryItem } from "../hooks/useFirestoreRuns";

const RUNS_PER_PAGE = 25;

export function ReportsPage() {
  const navigate = useNavigate();
  const { data: runs, loading, error } = useFirestoreRuns(1000); // Fetch more to filter completed
  const {
    trends,
    loading: trendsLoading,
    error: trendsError,
  } = useFirestoreMetrics(7);
  const integrityMetrics = useIntegrityMetrics();
  const trendChartRef = useRef<HTMLDivElement>(null);
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null);
  const [downloadingTrendReport, setDownloadingTrendReport] = useState(false);
  const [downloadingDashboardReport, setDownloadingDashboardReport] =
    useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter to only completed runs
  // Completed runs are any runs that are NOT "Running" or "Cancelled"
  // Status transformation in useFirestoreRuns:
  // - "success" or "healthy" → "Healthy"
  // - "warning" → "Warning"
  // - "critical" → "Critical"
  // - "error" → "Error"
  // - "running" → "Running"
  // - "cancelled"/"canceled" → "Cancelled"
  const completedRuns = useMemo(() => {
    const filtered = runs.filter((run) => {
      const status = run.status;
      // Exclude running and cancelled runs - everything else is completed
      return status !== "Running" && status !== "Cancelled";
    });

    // Debug logging to help diagnose filtering issues
    if (process.env.NODE_ENV === "development" && runs.length > 0) {
      const statusCounts = runs.reduce((acc, run) => {
        acc[run.status] = (acc[run.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log("Run status breakdown:", statusCounts);
      console.log(
        `Filtered ${filtered.length} completed runs from ${runs.length} total runs`
      );
    }

    return filtered;
  }, [runs]);

  // Calculate pagination
  const totalPages = Math.ceil(completedRuns.length / RUNS_PER_PAGE);
  const startIndex = (currentPage - 1) * RUNS_PER_PAGE;
  const endIndex = startIndex + RUNS_PER_PAGE;
  const paginatedRuns = completedRuns.slice(startIndex, endIndex);

  // Reset to page 1 when filtered runs change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleDownloadRunReport = async (
    run: RunHistoryItem,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent row click
    try {
      setDownloadingRunId(run.id);
      const blob = await generateRunReport(run);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const runDate = run.started_at?.toDate?.() || new Date();
      const dateStr =
        runDate instanceof Date
          ? runDate.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      a.download = `integrity-report-${run.id}-${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to generate report:", err);
      alert("Failed to generate report");
    } finally {
      setDownloadingRunId(null);
    }
  };

  const handleViewRun = (run: RunHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    navigate(`/run/${run.id || run.run_id}`);
  };

  const handleDownloadTrendReport = async () => {
    try {
      setDownloadingTrendReport(true);
      if (!trendChartRef.current) {
        throw new Error("Chart element not found");
      }

      const chartImage = await chartToImage(trendChartRef.current, {
        width: 1200,
        height: 600,
      });

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;

      // Header
      doc.setFillColor(62, 113, 106); // --brand color
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("7-Day Issue Trend Report", margin, 20);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const generatedDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(`Generated: ${generatedDate}`, margin, 35);

      // Add chart image
      const imgWidth = pageWidth - 2 * margin;
      const imgHeight = (imgWidth * 3) / 4; // Maintain aspect ratio
      doc.addImage(chartImage, "PNG", margin, 45, imgWidth, imgHeight);

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(153, 153, 153);
      doc.text(
        "Generated by Data Integrity Monitor",
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`7-day-trend-report-${dateStr}.pdf`);
    } catch (err) {
      console.error("Failed to generate trend report:", err);
      alert("Failed to generate trend report");
    } finally {
      setDownloadingTrendReport(false);
    }
  };

  const handleDownloadDashboardReport = async () => {
    try {
      setDownloadingDashboardReport(true);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // Helper to add text
      const addText = (text: string, fontSize: number, isBold = false) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
        doc.text(lines, margin, yPos);
        yPos += lines.length * (fontSize * 0.4) + 5;
        return lines.length;
      };

      // Header
      doc.setFillColor(62, 113, 106); // --brand color
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Full Dashboard Report", margin, 20);

      yPos = 35;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const generatedDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(`Generated: ${generatedDate}`, margin, yPos);
      yPos += 10;

      // Summary Cards Section
      const summary = integrityMetrics.summary.data?.summary;
      if (summary) {
        addText("System Status", 14, true);
        yPos += 5;

        const totalIssues = summary.total || 0;
        const bySeverity = summary.by_severity || {};
        const criticalCount = bySeverity.critical || 0;
        const warningCount = bySeverity.warning || 0;
        const infoCount = bySeverity.info || 0;

        addText(`Total Issues: ${totalIssues}`, 12);
        addText(`Critical: ${criticalCount}`, 11);
        addText(`Warning: ${warningCount}`, 11);
        addText(`Info: ${infoCount}`, 11);
        yPos += 5;
      }

      // Issue Queues Section
      const queues = integrityMetrics.queues.data || [];
      if (queues.length > 0) {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }
        addText("Issue Queues", 14, true);
        yPos += 5;
        queues.slice(0, 10).forEach((queue) => {
          addText(`${queue.title}: ${queue.count} - ${queue.detail}`, 10);
        });
        yPos += 5;
      }

      // Severity Breakdown
      const severityCounts =
        integrityMetrics.summary.data?.summary?.by_severity || {};
      if (Object.keys(severityCounts).length > 0) {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }
        addText("Severity Breakdown", 14, true);
        yPos += 5;
        addText(`Critical: ${severityCounts.critical || 0}`, 11);
        addText(`Warning: ${severityCounts.warning || 0}`, 11);
        addText(`Info: ${severityCounts.info || 0}`, 11);
        yPos += 5;
      }

      // Recent Runs
      const runHistory = integrityMetrics.runs.data || [];
      if (runHistory.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = margin;
        }
        addText("Recent Runs", 14, true);
        yPos += 5;
        runHistory.slice(0, 10).forEach((run) => {
          const runTime = run.started_at?.toDate?.() || new Date();
          const timeStr =
            runTime instanceof Date
              ? runTime.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Unknown";
          addText(
            `${timeStr} - ${run.status} - ${run.anomalies} issues - ${run.duration}`,
            9
          );
        });
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(153, 153, 153);
        doc.text(
          "Generated by Data Integrity Monitor",
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`dashboard-report-${dateStr}.pdf`);
    } catch (err) {
      console.error("Failed to generate dashboard report:", err);
      alert("Failed to generate dashboard report");
    } finally {
      setDownloadingDashboardReport(false);
    }
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
            onClick={handleDownloadTrendReport}
            disabled={true}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--brand)] text-sm font-medium rounded-md text-[var(--brand)] bg-white hover:bg-[var(--brand)]/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {downloadingTrendReport ? "Generating..." : "7-Day Trend Report"}
          </button>
          <button
            onClick={handleDownloadDashboardReport}
            disabled={downloadingDashboardReport}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--brand)] text-sm font-medium rounded-md text-[var(--brand)] bg-white hover:bg-[var(--brand)]/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {downloadingDashboardReport
              ? "Generating..."
              : "Full Dashboard Report"}
          </button>
        </div>
      </div>

      {/* Trend Graph */}
      <div
        className="bg-white shadow rounded-lg p-6"
        ref={trendChartRef}
        data-chart-ref
      >
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          7-Day Issue Trend
        </h2>
        <IssueTrendChart
          data={trends}
          loading={trendsLoading}
          error={trendsError}
        />
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
          <div className="p-8 text-center text-red-500">Error: {error}</div>
        ) : completedRuns.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No completed runs available.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Time
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
                      Issues
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
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedRuns.map((run) => {
                    const runDate = run.started_at?.toDate?.() || new Date();
                    const formattedTime =
                      runDate instanceof Date
                        ? `${runDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })} • ${runDate.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : run.time || "Unknown";

                    const statusColor =
                      run.status === "Critical"
                        ? "bg-blue-100 text-blue-800"
                        : run.status === "Warning"
                        ? "bg-yellow-100 text-yellow-800"
                        : run.status === "Healthy"
                        ? "bg-green-100 text-green-800"
                        : run.status === "Error"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800";

                    return (
                      <tr key={run.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formattedTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {run.duration ||
                            (run.duration_ms
                              ? `${(run.duration_ms / 1000).toFixed(1)}s`
                              : "-")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {run.anomalies}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {run.trigger || "manual"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleDownloadRunReport(run, e)}
                              disabled={downloadingRunId === run.id}
                              className="inline-flex items-center gap-1 text-[var(--brand)] hover:text-[var(--brand-light)] disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Download report"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                height="16"
                                viewBox="0 -960 960 960"
                                width="16"
                                fill="currentColor"
                              >
                                <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleViewRun(run, e)}
                              className="text-[var(--brand)] hover:text-[var(--brand-light)]"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{" "}
                      <span className="font-medium">
                        {completedRuns.length === 0 ? 0 : startIndex + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium">
                        {Math.min(endIndex, completedRuns.length)}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium">
                        {completedRuns.length}
                      </span>{" "}
                      completed runs
                    </p>
                  </div>
                  <div>
                    <nav
                      className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                      aria-label="Pagination"
                    >
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg
                          className="h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          // Show first page, last page, current page, and pages around current
                          return (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          );
                        })
                        .map((page, idx, arr) => {
                          // Add ellipsis if there's a gap
                          const showEllipsisBefore =
                            idx > 0 && arr[idx - 1] !== page - 1;
                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsisBefore && (
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  currentPage === page
                                    ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                }`}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg
                          className="h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
