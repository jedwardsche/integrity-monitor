# AI Data Integrity Monitor – Data Health Dashboard Layout & Metrics

Generated: 2025-11-19  
Sources: ContextPrime, CHE style/implementation guides, existing frontend prototype (`frontend/src/App.tsx`).

## 1. Dashboard Objectives
- Provide leadership with at-a-glance KPI status (duplicates, missing links, attendance anomalies).
- Enable drill-down to specific Data Issues and affected records.
- Mirror CHE visual language (Outfit/Epilogue typography, warm neutrals) per `CHE_STYLE_GUIDE.md`.
- Integrate with Firebase Auth, Firestore (`integrity_runs`, `integrity_metrics_daily`, optional `integrity_issues`), backed by FastAPI re-run endpoint.

## 2. Page Layout

### A. Global Structure
- **Header / Top Nav**
  - Product name + status badge (last run time, result).
  - Quick actions: “Run integrity scan” (POST to backend), “View last report”.
  - User avatar menu (from Firebase Auth).
- **Hero Summary (Top Section)**
  - KPI highlight card: `90%+ anomalies auto-identified` progress.
  - CTA buttons (Run scan, Download report).
- **Metrics Bento Grid**
  - Four summary cards (Open anomalies, Auto-resolved, High severity, Last run).
  - Each card shows count, delta vs prior day/week, severity color coding.
- **Trend & Breakdown Section**
  - Left: stacked bar or line chart showing anomaly counts by type over last 14 runs (data from `integrity_metrics_daily`).
  - Right: severity distribution donut/pie (info/warn/critical).
- **Guided Fixes / Issue Lists**
  - Tabs or cards for major issue categories (Duplicates, Missing Links, Attendance).
  - Each card lists top rule IDs with counts and “Review” link.
- **Recent Runs Table**
  - Table showing run ID, trigger, start/end time, status, anomalies found.
  - Link to run detail page (modal) showing counts per rule.
- **Drill-down Modal/Page**
  - When user selects “Review” for an issue category, show filtered list of issues with search/sort, linking back to Airtable record.

### B. Responsive Behavior
- Use CHE grid spacing (max width 6xl). On mobile, stack sections vertically, convert charts to simplified sparkline + count.

## 3. Metrics & Data Sources

| Metric | Description | Source |
| --- | --- | --- |
| Open anomalies | Count of Data Issues `status=open` grouped by type | Firestore mirror (`integrity_issues`) or Airtable view |
| Auto-resolved rate | % of issues auto-resolved this week (`status=resolved` + `resolved_by=automation`) | Firestore metrics |
| High severity records | Number of unique students with critical anomalies | Derived from `integrity_metrics_daily.severity_counts.critical` |
| Last run timestamp/duration | Last successful run info | `integrity_runs` |
| Trend chart | Daily counts per issue type | `integrity_metrics_daily` |
| Severity donut | Latest counts by severity level | `integrity_metrics_daily` |
| Fix cards | Top 3 issue categories needing attention (rule_id summary) | Aggregated from `integrity_metrics_daily.rule_counts` |
| Recent runs table | History of last 10 runs | `integrity_runs` |
| Drill-down issue list | Filtered list (rule_id, affected record, severity, age) | `integrity_issues` collection or Airtable view |

## 4. Drill-Down Interactions

- **Issue Cards → Filter View**
  - Clicking “Duplicate Parents” navigates to `/issues?type=duplicate&entity=parent` loading Firestore query or Airtable view ID.
- **Trend Chart → Runs**
  - Selecting a point opens modal showing run summary + link to raw run doc.
- **Run Detail Modal**
  - Shows metrics, config hash, logs link.
- **Actions**
  - “Mark resolved” button (if permitted) writes to Firestore/Airtable status.
  - “Open in Airtable” deep link via record ID.

## 5. Component Outline (React)

```
src/components/
  Header.tsx      // Branding, run action buttons
  MetricCard.tsx
  MetricsGrid.tsx
  TrendChart.tsx  // e.g., using Recharts
  SeverityDonut.tsx
  IssueCard.tsx
  IssueList.tsx
  RunsTable.tsx
  RunDetailModal.tsx
```

- Use Tailwind classes aligned with CHE palette (import fonts from style guide).
- Components pull data via hooks `useRuns()`, `useMetrics()`, `useIssues()` using Firestore SDK.

## 6. Implementation Notes

- **Data Fetching**
  - Use Firestore `onSnapshot` for live updates on metrics and issues.
  - For large issue sets, paginate using Firestore queries with indexes (`status`, `rule_id`, `severity`).
- **Caching & Performance**
  - Store aggregated metrics in `integrity_metrics_daily` to avoid heavy calculations client-side.
- **Access Control**
  - Use Firebase Auth + Firestore rules restricting reads to `users/{uid}.isAdmin = true`.
- **Styling**
  - Apply CHE fonts via global CSS; use warm neutrals background `--bg-warm-light`.
  - Use brand/tone colors for severity chips (success/warn/error classes).
- **Empty States**
  - Provide friendly messaging when no anomalies or data not yet available.
- **Error Handling**
  - Show toast/snackbar for failed manual run triggers.

## 7. Future Enhancements

- Add filters by campus or term.
- Enable CSV export of issues.
- Integrate with Airtable’s new interface designer for in-Airtable drill-down if desired.
