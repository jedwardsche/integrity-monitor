# AI Data Integrity Monitor – Automation, QA Strategy, and KPI Measurement

Generated: 2025-11-19  
Sources: ContextPrime, CHE guides, previous prompts.

## 1. Automation Plan

### Schedules & Execution
- **Nightly integrity scan** (`integrity-nightly`)
  - Cloud Scheduler cron: `0 2 * * *`
  - Hits Cloud Run `/integrity/run?mode=incremental`
  - Retries: 3 attempts, exponential backoff (1m, 5m, 15m)
- **Weekly full scan** (`integrity-weekly`)
  - Cron: `0 3 * * 0`
  - Parameter `mode=full` disables incremental filters, recomputes attendance stats.
- **Manual runs**
  - Triggered by dashboard button; requires Firebase Auth token with admin role.

### Alerts & Notifications
- Cloud Monitoring alert if:
  - Run fails twice consecutively.
  - Runtime exceeds 15 minutes.
  - Issues detected exceed threshold (e.g., duplicates > 500).
- Alert channels: Slack webhook + email to data ops.

### Failure Handling
- Each run writes `integrity_runs/{runId}` with `status`.
- On failure:
  - Cloud Run logs error, returns 500.
  - Firestore doc `status=error`, `error_message`.
  - Slack alert with run ID and link to logs.
- On partial failure (one check fails):
  - Record `status=warning`, include `failed_checks` list.
  - Next run attempts full re-check for failed modules.

## 2. QA Strategy

### Data Fixtures
- Maintain synthetic Airtable base (dev) with curated cases:
  - Duplicate students/parents/contractors with known expected groups.
  - Broken links (e.g., students without parents) and missing fields.
  - Attendance edge cases (new students, limited schedules).
- Snapshot sample records in JSON under `tests/fixtures/`.

### Testing Layers
- **Unit tests** (pytest)
  - Normalization utilities.
  - Duplicate scoring/classification functions.
  - Link/required rules evaluation logic.
  - Attendance metric calculations (absence rate, consecutive counts).
- **Integration tests**
  - Mock Airtable + Firestore clients (using responses/httpretty or custom stub) to simulate API interactions.
  - End-to-end run using fixtures to ensure issues emitted as expected.
- **Regression tests**
  - After each rules change, run fixtures and compare issue outputs to golden files stored in repo.

### QA Process
- Pre-release checklist:
  1. Update fixtures to reflect schema changes.
  2. Run `pytest`, ensure 100% pass.
  3. Execute local run against sandbox Airtable base; verify Data Issues table matches expected counts.
  4. Run manual dashboard check to ensure metrics display correctly.
- Document QA results in release notes (Conventional Commit + tag).

## 3. Feedback Loop & Rule Tuning

- **Airtable Workflow**
  - Data Issues table includes `Status` (`open/resolved/ignored`) and `Resolution Notes`.
  - Staff mark `ignored` for false positives and specify reason.
- **Backend Use**
  - Nightly job ingests Data Issues statuses; if `ignored` count for a rule exceeds threshold (e.g., >10%), flag for review.
  - Provide Firestore dashboard widget showing “Most ignored rules.”
- **Tuning Process**
  - Data ops reviews flagged rules weekly.
  - Adjust thresholds or disable rules via Firestore overrides (without redeploy).
  - Record adjustments in `context.md` or dedicated change log.

## 4. KPI Measurement (90%+ anomaly detection)

### Definition
- KPI: “At least 90% of true data anomalies are automatically identified by the monitor.”
- Approach:
  1. Maintain **validation sample** each week: random 100 records per key entity or previously resolved issues.
  2. Human reviewers label anomalies vs clean records.
  3. Compare against AI monitor detections:
     - **True positives**: issues both monitor and reviewers flag.
     - **False negatives**: reviewer found but monitor missed.
     - **False positives**: monitor flagged but reviewer disagreed.
  4. KPI = `true_positives / (true_positives + false_negatives)`.

### Tracking
- Store sampling results in Firestore `integrity_kpi_samples/{weekId}` with fields:
  - `sample_size`, `true_positives`, `false_negatives`, `false_positives`, `kpi_percent`.
- Dashboard section showing KPI trend and last measured date.
- If KPI < 90%:
  - Auto-create task to review rule coverage (which modules missed anomalies).
  - Increase sampling frequency to daily until KPI recovers.

## 5. Documentation & Release Management

- Maintain `docs/runbook.md` summarizing deployment, rollback, alert response.
- Use Conventional Commits; tag releases `vY.N.Z`.
- Each release note includes:
  - Config hash.
  - KPI sample result.
  - QA checklist outcome.
