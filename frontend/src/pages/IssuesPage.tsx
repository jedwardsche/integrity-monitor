import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IssueList } from "../components/IssueList";
import { useIssueCounts } from "../hooks/useIssueCounts";
import { useIssueActions } from "../hooks/useIssueActions";
import { BulkDeleteModal } from "../components/BulkDeleteModal";
import ConfirmModal from "../components/ConfirmModal";
import deleteSweepIcon from "../assets/delete_sweep.svg";

export function IssuesPage() {
  const navigate = useNavigate();
  const { counts: issueCounts, loading: countsLoading } = useIssueCounts();
  const { bulkDeleteIssues, countBulkDeleteIssues } = useIssueActions();
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteFilters, setDeleteFilters] = useState<{
    issueTypes: string[];
    entities: string[];
    dateRange: "past_hour" | "past_day" | "past_week" | "custom" | "all";
    customStartDate?: string;
    customEndDate?: string;
  } | null>(null);
  const [deleteResult, setDeleteResult] = useState<{
    success: boolean;
    count?: number;
    message?: string;
  } | null>(null);
  const [issueListKey, setIssueListKey] = useState(0);
  const [deleteProgress, setDeleteProgress] = useState<{
    stage: "counting" | "deleting" | null;
    total: number;
    current: number;
  } | null>(null);

  const handleBulkDeleteConfirm = (filters: {
    issueTypes: string[];
    entities: string[];
    dateRange: "past_hour" | "past_day" | "past_week" | "custom" | "all";
    customStartDate?: string;
    customEndDate?: string;
  }) => {
    setDeleteFilters(filters);
    setShowBulkDelete(false);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteFilters) return;

    setShowConfirm(false);
    setDeleteProgress({ stage: "counting", total: 0, current: 0 });

    try {
      // First, count how many issues will be deleted
      const totalCount = await countBulkDeleteIssues(deleteFilters);
      setDeleteProgress({ stage: "deleting", total: totalCount, current: 0 });

      // Start progress animation (estimated based on time)
      const startTime = Date.now();
      const estimatedDuration = Math.max(2000, totalCount * 10); // At least 2 seconds, ~10ms per issue
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(95, Math.floor((elapsed / estimatedDuration) * 100));
        setDeleteProgress((prev) => 
          prev ? { ...prev, current: Math.floor((progress / 100) * prev.total) } : null
        );
      }, 100);

      // Perform the actual deletion
      const count = await bulkDeleteIssues(deleteFilters);
      
      clearInterval(progressInterval);
      setDeleteProgress({ stage: "deleting", total: totalCount, current: totalCount });
      
      // Show completion briefly
      setTimeout(() => {
        setDeleteProgress(null);
        setDeleteResult({ success: true, count });
        setIssueListKey((prev) => prev + 1); // Force refresh of IssueList
        setTimeout(() => {
          setDeleteResult(null);
          setDeleteFilters(null);
        }, 3000);
      }, 500);
    } catch (error) {
      setDeleteProgress(null);
      setDeleteResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete issues",
      });
      setTimeout(() => {
        setDeleteResult(null);
        setDeleteFilters(null);
      }, 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      {deleteProgress && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm font-medium text-blue-800">
                {deleteProgress.stage === "counting"
                  ? "Loading issues to delete..."
                  : `Deleting issues: ${deleteProgress.current.toLocaleString()} / ${deleteProgress.total.toLocaleString()}`}
              </span>
            </div>
            {deleteProgress.stage === "deleting" && (
              <span className="text-sm text-blue-600">
                {deleteProgress.total > 0
                  ? Math.round((deleteProgress.current / deleteProgress.total) * 100)
                  : 0}%
              </span>
            )}
          </div>
          {deleteProgress.stage === "deleting" && deleteProgress.total > 0 && (
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (deleteProgress.current / deleteProgress.total) * 100)}%`,
                }}
              ></div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-semibold text-[var(--text-main)] mb-2"
            style={{ fontFamily: "Outfit" }}
          >
            All Issues
          </h1>
          <p className="text-[var(--text-muted)]">
            View and manage all data integrity issues across the system
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/rules")}
            className="px-4 py-2 border border-[var(--cta-blue)] bg-white text-[var(--cta-blue)] rounded-lg hover:bg-[var(--cta-blue)]/5 transition-colors"
          >
            View Rules
          </button>
          <button
            onClick={() => setShowBulkDelete(true)}
            className="p-2 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 transition-colors"
            title="Bulk Delete Issues"
          >
            <img
              src={deleteSweepIcon}
              alt="Bulk Delete"
              className="w-6 h-6"
              style={{
                filter:
                  "brightness(0) saturate(100%) invert(20%) sepia(100%) saturate(5000%) hue-rotate(350deg) brightness(90%) contrast(100%)",
              }}
            />
          </button>
        </div>
      </div>

      {deleteResult && (
        <div
          className={`p-4 rounded-lg border ${
            deleteResult.success
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {deleteResult.success
            ? `Successfully deleted ${deleteResult.count || 0} issues.`
            : `Error: ${deleteResult.message || "Failed to delete issues"}`}
        </div>
      )}

      {/* Issue Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4">
          <p className="text-sm text-[var(--text-muted)]">Total Issues</p>
          <p
            className="text-2xl font-semibold text-[var(--text-main)] mt-1"
            style={{ fontFamily: "Outfit" }}
          >
            {countsLoading ? "..." : issueCounts.all}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4">
          <p className="text-sm text-[var(--text-muted)]">Open</p>
          <p
            className="text-2xl font-semibold text-[var(--text-main)] mt-1"
            style={{ fontFamily: "Outfit" }}
          >
            {countsLoading ? "..." : issueCounts.open}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4">
          <p className="text-sm text-[var(--text-muted)]">Closed</p>
          <p
            className="text-2xl font-semibold text-[var(--text-main)] mt-1"
            style={{ fontFamily: "Outfit" }}
          >
            {countsLoading ? "..." : issueCounts.closed}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 p-4">
          <p className="text-sm text-[var(--text-muted)]">Resolved</p>
          <p
            className="text-2xl font-semibold text-[var(--text-main)] mt-1"
            style={{ fontFamily: "Outfit" }}
          >
            {countsLoading ? "..." : issueCounts.resolved}
          </p>
        </div>
      </div>

      {/* Issue List with integrated filters */}
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-6">
        <IssueList key={issueListKey} />
      </div>

      <BulkDeleteModal
        isOpen={showBulkDelete}
        onClose={() => setShowBulkDelete(false)}
        onConfirm={handleBulkDeleteConfirm}
      />

      <ConfirmModal
        isOpen={showConfirm}
        title="Confirm Bulk Delete"
        message={
          deleteFilters
            ? `Are you sure you want to delete issues matching your criteria? This action cannot be undone.`
            : ""
        }
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowConfirm(false);
          setDeleteFilters(null);
        }}
      />
    </div>
  );
}
