# AI Data Integrity Monitor – Architecture & Scheduling Plan

Generated: 2025-11-19  
Sources: `ChatGPT_Master_Prompt.md` (ContextPrime), `CHE_IMPLEMENTATION_GUIDE.md`, `CHE_STYLE_GUIDE.md`, `docs/prompt-1-schema-spec.md`, Airtable integration guardrails in `context.md`.

## 1. System Overview

- **Runtime & Hosting**
  - Python FastAPI service packaged as a Docker container.
  - Deploy to **Google Cloud Run** (fully managed, autoscaling) in prod; local dev via uvicorn.
- **Triggering**
  - **Cloud Scheduler** issues authenticated `POST /integrity/run` requests nightly, plus optional weekly deep scan.
  - Manual re-run available via Firebase-authenticated frontend calling same endpoint.
- **Data Sources / Stores**
  - Airtable bases = source of truth (Students, Parents, Contractors, Classes, Attendance, Truth, Payments, Data Issues).
  - Firestore = run metadata (`integrity_runs`), aggregated metrics (`integrity_metrics_daily`), optional `integrity_issues` mirror for dashboard performance.
  - Google Secret Manager / env vars store Airtable PATs, base IDs, Firebase credentials.

## 2. Backend Architecture

- **Primary Components**
  1. **config** module: static Python dataclasses / YAML describing entity ↔ Airtable IDs, fields, rule toggles, thresholds.
  2. **clients** module: Airtable client (pyairtable) + Firestore client wrappers with retry + logging.
  3. **fetchers**: batched Airtable queries per table with optional `lastModifiedTime` filters.
  4. **checks**:
     - `duplicates.py`, `links.py`, `attendance.py`, `required_fields.py`.
     - Each returns structured anomalies using shared schema.
  5. **writers**: upsert issues into Airtable Data Issues table + Firestore metrics; dedupe via `rule_id + record_id`.
  6. **scheduler entry**: FastAPI route orchestrating config load, fetch, run, persist, emit run summary.
  7. **logging/metrics**: structured logs to Cloud Logging; per-run metrics doc with counts, durations, severity tallies.
- **Security**
  - Only Cloud Scheduler service account + authenticated frontend allowed to hit `/integrity/run`.
  - Airtable PATs never persist in Firestore; stored as env vars / Secret Manager and injected at runtime.
  - Principle of least privilege for Firestore service account (read/write limited collections).

## 3. Configurable Rules & Thresholds

- **Location:** `backend/config/rules.yaml` (checked in) + `backend/config/env.py` (loads secret env vars).
- **Contents:**
  - `entities`: mapping to Airtable base/table IDs, key fields.
  - `duplicate_rules`: normalization options, similarity thresholds (`likely`, `possible`), per entity.
  - `link_rules`: required relationships with min/max counts.
  - `required_fields`: per entity list with severity and remediation text.
  - `attendance_rules`: term definitions, absence % thresholds, severity cutoffs.
  - `run_schedules`: cron strings + job labels for Cloud Scheduler.
- **Override Strategy:**
  - Allow remote overrides via Firestore doc `integrity_config/current` (e.g., per-campus thresholds). Loader merges local YAML defaults with Firestore overrides at runtime.

## 4. Scheduling Cadence

- **Nightly job (02:00 local)**
  - Runs all checks with incremental fetch (`lastModifiedTime > prevRun`).
  - Purpose: keep Data Issues current, feed metrics for dashboard.
- **Weekly full scan (Sunday 03:00)**
  - Force full refresh (ignore incremental) to catch missed updates, recalc attendance metrics per term.
- **On-demand scan**
  - Triggered from dashboard button; uses same pipeline but flagged `manual`.
- **Retries & Alerting**
  - Cloud Scheduler uses 3 retry attempts with exponential backoff.
  - FastAPI returns structured error with run ID; failure writes `status=error` doc in `integrity_runs`.
  - Cloud Monitoring alert on error runs or consecutive failures >1.

## 5. Anomaly Storage Design

- **Airtable Data Issues table** (canonical issue log)
  - Fields:
    - `Rule ID` (text) – stable key (`dup.student.email_exact` etc.).
    - `Affected Table` (single select).
    - `Affected Record` (linked record).
    - `Issue Type` (duplicate / missing_link / missing_field / attendance).
    - `Severity` (info/warn/critical).
    - `Confidence` (number 0-1).
    - `Description` (long text).
    - `Suggested Fix` (long text).
    - `Status` (open/resolved/ignored).
    - `First Detected` / `Last Seen` (date).
  - Upsert rule: find existing by `Rule ID + Affected Record`; update `Last Seen` + details else insert new.
- **Firestore Mirrors**
  - `integrity_runs/{runId}`: summary document with timestamps, counts per issue type, source commit hash, duration, schedule label, success/error.
  - `integrity_metrics_daily/{YYYYMMDD}`: aggregated counts per entity, severity, trend baseline for dashboard charts.
  - Optional `integrity_issues/{issueId}`: flattened copy for fast filtering; store subset fields + Airtable `issue_id`.

## 6. Deployment & Operations

- **CI/CD**
  - Build Docker image via GitHub Actions or Cloud Build.
  - Push to Artifact Registry; deploy to Cloud Run with `--set-secrets`.
- **Environment Separation**
  - `dev`, `staging`, `prod` Cloud Run services with matching Firestore collections (namespaced) and Airtable sandbox bases.
- **Monitoring**
  - Cloud Logging sinks for application logs tagged with run ID.
  - Cloud Monitoring dashboards for request latency, error counts, anomaly counts trend.
- **Disaster Recovery**
  - Firestore + Airtable backups already managed (per org policy); ensure config YAML is versioned.
  - Cloud Scheduler/Run IaC (Terraform or gcloud scripts) stored in repo for reproducible setup.

## 7. Implementation Checklist

1. Build `backend/config` package with YAML loader + dataclasses, merge with Firestore overrides.
2. Implement Airtable + Firestore clients honoring retry/backoff and secret management.
3. Flesh out check modules using rules from prompt 1 + upcoming prompts.
4. Create Data Issues table in Airtable with schema above; add `Has Data Issues` boolean on source tables.
5. Define Cloud Scheduler jobs:
   - `integrity-nightly`: `0 2 * * *`.
   - `integrity-weekly`: `0 3 * * 0`.
6. Containerize FastAPI, deploy to Cloud Run, secure endpoint with IAM + Firebase token verification.
7. Instrument logging and per-run Firestore summaries for dashboard integration.
