import { IssueList } from "../components/IssueList";
import { useIssueCounts } from "../hooks/useIssueCounts";

export function IssuesPage() {
  const { counts: issueCounts, loading: countsLoading } = useIssueCounts();

  return (
    <div className="space-y-6">
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
        <IssueList />
      </div>
    </div>
  );
}
