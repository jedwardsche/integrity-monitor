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
  const { bulkDeleteIssues } = useIssueActions();
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
    try {
      const count = await bulkDeleteIssues(deleteFilters);
      setDeleteResult({ success: true, count });
      setIssueListKey((prev) => prev + 1); // Force refresh of IssueList
      setTimeout(() => {
        setDeleteResult(null);
        setDeleteFilters(null);
      }, 3000);
    } catch (error) {
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
