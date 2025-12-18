import { useState, useEffect, useMemo } from "react";
import type { Issue, IssueFilters } from "../hooks/useFirestoreIssues";
import { useFirestoreIssues } from "../hooks/useFirestoreIssues";
import { useIssueActions } from "../hooks/useIssueActions";
import { useAuth } from "../hooks/useAuth";
import { getAirtableLinkByEntity, getDataIssuesLink } from "../utils/airtable";
import ConfirmModal from "./ConfirmModal";

const ITEMS_PER_PAGE = 25;

interface IssueListProps {
  filters?: IssueFilters;
  onClose?: () => void;
}

export function IssueList({
  filters: initialFilters = {},
  onClose,
}: IssueListProps) {
  const [filters, setFilters] = useState<IssueFilters>(initialFilters);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const {
    data: allIssues,
    loading,
    error,
  } = useFirestoreIssues({ ...filters, search });
  const { markResolved, loading: actionLoading } = useIssueActions();
  const { isAdmin } = useAuth();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    issueId: string | null;
  }>({
    isOpen: false,
    issueId: null,
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, search]);

  // Calculate pagination
  const { issues, totalIssues, totalPages, startIndex, endIndex } =
    useMemo(() => {
      const total = allIssues.length;
      const pages = Math.ceil(total / ITEMS_PER_PAGE);
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const paginatedIssues = allIssues.slice(start, end);

      return {
        issues: paginatedIssues,
        totalIssues: total,
        totalPages: pages,
        startIndex: start,
        endIndex: Math.min(end, total),
      };
    }, [allIssues, currentPage]);

  const initiateResolve = (issueId: string) => {
    setConfirmModal({ isOpen: true, issueId });
  };

  const handleConfirmResolve = async () => {
    const issueId = confirmModal.issueId;
    if (!issueId) return;

    setConfirmModal({ isOpen: false, issueId: null });
    setResolvingId(issueId);
    try {
      await markResolved(issueId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resolve issue");
    } finally {
      setResolvingId(null);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-[#f8d7da] text-[#a61b2b]";
      case "warning":
        return "bg-[#ffecc7] text-[#b35300]";
      default:
        return "bg-[#d7ecff] text-[#22598c]";
    }
  };

  const formatAge = (date: Date | undefined) => {
    if (!date) return "Unknown";
    const now = new Date();
    const timeValue = date.getTime();
    if (isNaN(timeValue)) return "Unknown";

    const diffMs = now.getTime() - timeValue;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMinutes > 0) return `${diffMinutes}m`;
    return "Just now";
  };

  return (
    <div className="space-y-4">
      {onClose && (
        <div className="flex items-center justify-between">
          <h2
            className="text-xl font-semibold text-[var(--text-main)]"
            style={{ fontFamily: "Outfit" }}
          >
            Issue Details
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by rule ID or record ID..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-main)]"
        />
        <select
          value={filters.severity || ""}
          onChange={(e) =>
            setFilters({ ...filters, severity: e.target.value || undefined })
          }
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-main)]"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select
          value={filters.type || ""}
          onChange={(e) =>
            setFilters({ ...filters, type: e.target.value || undefined })
          }
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-main)]"
        >
          <option value="">All Types</option>
          <option value="duplicate">Duplicate</option>
          <option value="missing_link">Missing Link</option>
          <option value="missing_field">Missing Field</option>
          <option value="attendance">Attendance</option>
        </select>
      </div>

      {loading && (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--brand)] mb-2"></div>
          <p>Loading issues...</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="text-center py-8 text-[var(--text-muted)]">
          No issues found
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <>
          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-mid)] text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3 text-right">Age</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => {
                  const airtableLink = getAirtableLinkByEntity(
                    issue.entity,
                    issue.record_id
                  );
                  return (
                    <tr
                      key={issue.id}
                      className="border-t border-[var(--border)]/70"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {issue.rule_id}
                      </td>
                      <td className="px-4 py-3">{issue.entity}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${getSeverityColor(
                            issue.severity
                          )}`}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {airtableLink ? (
                          <a
                            href={airtableLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--cta-blue)] hover:underline"
                            title="Open in Airtable"
                          >
                            {issue.record_id}
                          </a>
                        ) : (
                          <span className="text-[var(--text-muted)]">
                            {issue.record_id}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">
                        {formatAge(issue.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {airtableLink && (
                            <a
                              href={airtableLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[var(--cta-blue)] hover:underline"
                            >
                              Open
                            </a>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => initiateResolve(issue.id)}
                              disabled={
                                actionLoading && resolvingId === issue.id
                              }
                              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-50"
                            >
                              {actionLoading && resolvingId === issue.id
                                ? "..."
                                : "Resolve"}
                            </button>
                          )}
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
            <div className="flex items-center justify-between text-sm">
              <div className="text-[var(--text-muted)]">
                Showing {startIndex + 1}-{endIndex} of {totalIssues} issues
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-mid)]"
                >
                  Previous
                </button>
                <span className="text-[var(--text-muted)]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-mid)]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Resolve Issue"
        message="Are you sure you want to mark this issue as resolved? This will update the status in Firestore."
        confirmLabel="Resolve"
        onConfirm={handleConfirmResolve}
        onCancel={() => setConfirmModal({ isOpen: false, issueId: null })}
      />
    </div>
  );
}
