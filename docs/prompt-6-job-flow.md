# AI Data Integrity Monitor – Job Flow, Modules, and Config Layout

Generated: 2025-11-19  
Sources: ContextPrime, CHE guides, prior prompt outputs.

## 1. Module Breakdown (Python FastAPI backend)

```
backend/
├── main.py                # FastAPI app + /integrity/run route
├── config/
│   ├── loader.py          # Load YAML + env + Firestore overrides
│   ├── models.py          # Pydantic/dataclass definitions (Entities, Rules)
│   └── rules.yaml         # Default config (checked in)
├── clients/
│   ├── airtable.py        # pyairtable wrapper with retries, rate limiting
│   ├── firestore.py       # Firestore client for runs/metrics
│   └── logging.py         # Structured logger utilities
├── fetchers/
│   ├── students.py
│   ├── parents.py
│   └── ...
├── checks/
│   ├── duplicates.py
│   ├── links.py
│   ├── required_fields.py
│   └── attendance.py
├── analyzers/
│   └── scorer.py          # Aggregates check outputs, dedupes issues
├── writers/
│   ├── airtable_writer.py # Upserts Data Issues + Has Issue flags
│   └── firestore_writer.py# Run summaries, metrics
└── utils/
    ├── normalization.py   # Shared normalization (names, phones)
    └── windowing.py       # Attendance windows, incremental scans
```

- **tests/** mirror structure for unit tests when added.

## 2. End-to-End Execution Flow

1. **Trigger**
   - Cloud Scheduler `POST /integrity/run` with service account token (or manual button using Firebase auth) hits FastAPI route.
2. **Run Context Init**
   - Assign `run_id`, log start time, capture trigger source (nightly/weekly/manual), commit hash.
3. **Config Load**
   - `config.loader` reads `rules.yaml`, merges env (base IDs, API keys) and Firestore override doc (`integrity_config/current`).
4. **Data Fetch**
   - For each entity, fetchers pull Airtable records using pyairtable.
   - Use incremental filter (lastModifiedTime > last_successful_run) unless full scan requested.
   - Cache raw JSON for auditing (in-memory / temp storage).
5. **Checks Execution**
   - Duplicate check: `checks.duplicates.run(config.duplicate_rules, students, parents, contractors)`.
   - Link + required field check: `checks.links.run`, `checks.required_fields.run`.
   - Attendance anomaly check: `checks.attendance.run`.
   - Each returns list of `Issue` objects (`IssuePayload` dataclass).
6. **Aggregate + Dedup**
   - `analyzers.scorer.merge(issues)` groups by `rule_id + record_id`, recomputes severity/confidence if needed.
7. **Persist Results**
   - `writers.airtable_writer.upsert(issues)` writes/updates Data Issues and toggles `Has Data Issues` on affected records.
   - `writers.firestore_writer.record_run(run_id, metrics)` writes run summary + metrics documents.
8. **Finalize**
   - Log metrics (counts by type/severity, durations).
   - Return HTTP 200 with run summary.
   - On failure, log + store `status=error` and raise HTTP 500.

## 3. Config Layout

```
config/
  rules.yaml
  entities.yaml (optional)
  __init__.py
```

**rules.yaml** structure:
```yaml
entities:
  students:
    airtable:
      base_id: env("AT_STUDENTS_BASE")
      table_id: env("AT_STUDENTS_TABLE")
      view_id: optional
    key_fields: [student_id, truth_id, email, phone]
duplicate_rules:
  students:
    block_keys: ["last_name_soundex_dob", "email_localpart"]
    weights:
      email_exact: 0.6
      phone_exact: 0.3
      name_similarity: 0.2
    thresholds:
      likely: 0.8
      possible: 0.6
link_rules: ... (from prompt 4)
required_fields: ... (prompt 4)
attendance_rules: ... (prompt 5)
run_config:
  incremental: true
  nightly_cron: "0 2 * * *"
  weekly_cron: "0 3 * * 0"
```

**env variables** stored in `.env` (local) or Secret Manager (prod). `loader.py` resolves `env("VAR")` placeholders.

**Firestore overrides** example (document `integrity_config/current`):
```json
{
  "attendance_rules": {
    "absence_rate_term": {
      "warning": 0.18
    }
  },
  "duplicate_rules": {
    "students": {
      "thresholds": {
        "likely": 0.82
      }
    }
  }
}
```

Loader merges overrides with YAML before freezing config dataclasses.

## 4. Logging & Metrics

- **Structured Logging**
  - Use `logging.py` to emit JSON logs with `run_id`, `stage`, `duration_ms`, `entity_counts`, severity breakdown.
  - Log major stages: config_load, fetch, duplicates, links, attendance, write_airtable, write_firestore.
- **Metrics Recorded per Run**
  - Total records fetched per entity.
  - Number of issues per type (duplicate, missing_link, missing_field, attendance) and severity.
  - Duplicate groups formed/resolved counts.
  - Attendance anomalies by metric (absence_rate, consecutive, tardy).
  - Runtime durations per stage.
- **Firestore `integrity_runs` document fields**
  - `run_id`, `trigger`, `started_at`, `ended_at`, `duration_ms`.
  - `counts`: nested object by `issue_type`.
  - `status`: success/error.
  - `config_version`: checksum of rules YAML + override hash.
- **Alerts**
  - Cloud Monitoring to alert on:
    - consecutive failures >1.
    - run duration > threshold.
    - anomalies exceeding defined caps (optional).

## 5. Execution Safeguards

- Rate limiting & retries on Airtable API to stay within quotas.
- Chunk writes to Airtable Data Issues to avoid HTTP 413 (batch size ~10).
- Use idempotent operations: `run_id` ensures repeated Cloud Scheduler retries do not duplicate Firestore runs.
- Wrap each check in try/except to continue (but mark run status partial failure) if one module fails; final status = warning.
