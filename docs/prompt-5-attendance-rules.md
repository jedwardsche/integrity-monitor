# AI Data Integrity Monitor – Attendance Anomaly Rules & Thresholds

Generated: 2025-11-19  
Sources: ContextPrime, CHE guides, `docs/prompt-1-schema-spec.md`, `docs/prompt-2-architecture-plan.md`.

## 1. Attendance Anomaly Definitions

### A. Excessive Absence Rules
- **Percentage Thresholds**
  - Warning: Absences >15% of scheduled sessions in rolling 30-day window.
  - Critical: Absences >25% of scheduled sessions in current term.
- **Absolute Counts**
  - Warning: ≥5 absences within any 4-week span.
  - Critical: ≥8 absences within a term OR ≥3 consecutive weeks with ≥1 absence per week.
- **Consecutive Absences**
  - Warning: 3 consecutive absences for same class.
  - Critical: 5+ consecutive absences OR entire week missed (all classes).
- **Per-Term Logic**
  - Calculate per active term; reset when term changes.
  - For block schedules, normalize by `classes_per_week`.

### B. Tardy & Partial Attendance
- Flag when tardy rate exceeds 20% of attended sessions.
- Flag partial attendance (<50% of scheduled minutes) more than 3 times per month.

### C. Edge Cases
- **New Students**
  - Ignore absences during first 7 days after enrollment start.
- **Partial-Term Enrollments**
  - Scale thresholds to actual enrolled days (e.g., student joining mid-term).
- **Limited Schedules**
  - For students with <3 classes/week, use absolute counts rather than percentages (e.g., 2 absences in 2 weeks = warning).

## 2. Severity Model

| Severity | Criteria Examples | Action |
| --- | --- | --- |
| Info | Early warning: absences 10–15%, sporadic tardies | Monitor |
| Warning | Absences >15% or ≥5 in 4 weeks, 3 consecutive | Contact family |
| Critical | Absences >25%, ≥8 per term, 5 consecutive, whole-week misses | Escalate to campus lead |

Severity escalates automatically if multiple criteria met; highest level wins.

## 3. Anomaly Schema

### Airtable Data Issues Fields (attendance-specific)
- `Issue Type`: `attendance`.
- `Student`: linked student record.
- `Class`: optional link when anomaly specific to class.
- `Metric`: e.g., `absence_rate_30d`, `consecutive_absences`, `tardy_rate`.
- `Observed Value`: numeric (percentage or count).
- `Threshold`: numeric for comparison.
- `Window`: `30d`, `term`, `weekly`.
- `Severity`: info/warning/critical.
- `Suggested Fix`: e.g., “Reach out to family,” “Review schedule.”

### Example Record
| Field | Value |
| --- | --- |
| Issue Type | attendance |
| Student | `recStu123` |
| Class | `recClass456` |
| Metric | `absence_rate_term` |
| Observed Value | `0.28` |
| Threshold | `0.25` |
| Window | `term` |
| Severity | critical |
| Description | “Student absent 28% of term sessions (threshold 25%).” |

## 4. Pseudo-Code Outline

```python
def analyze_attendance(student_records, attendance_rules):
    findings = []
    for student in student_records:
        schedule = fetch_schedule(student)
        attendance = fetch_attendance(student, schedule.term_range)
        windows = build_windows(attendance)

        metrics = {
            "absence_rate_30d": absence_rate(attendance, window="30d"),
            "absence_rate_term": absence_rate(attendance, window="term"),
            "absences_4w": count_absences(attendance, window="28d"),
            "consecutive_absences": max_consecutive(absences=attendance.absent_days),
            "tardy_rate": tardy_rate(attendance),
            "partial_count": count_partial(attendance),
        }

        metrics = adjust_for_edge_cases(metrics, student, schedule)
        for metric_name, value in metrics.items():
            rule = attendance_rules[metric_name]
            severity = classify(value, rule.thresholds)
            if severity:
                findings.append(build_issue(student, metric_name, value, rule, severity))

    return findings
```

Supporting functions:
- `build_windows`: groups attendance records into rolling windows (`30d`, `term`).
- `absence_rate`: `absent_sessions / scheduled_sessions` (excludes excused if configured).
- `adjust_for_edge_cases`: skip windows during onboarding period; scale thresholds for partial schedules.
- `classify`: compare value to severity thresholds (info < warning < critical).
- `build_issue`: produce Airtable/Firestore payload per schema above.

## 5. Configuration Example

```yaml
attendance_rules:
  absence_rate_30d:
    thresholds:
      info: 0.10
      warning: 0.15
      critical: 0.25
    window: 30d
  absence_rate_term:
    thresholds:
      warning: 0.20
      critical: 0.25
    window: term
  absences_4w:
    thresholds:
      warning: 5
      critical: 8
    window: 28d
  consecutive_absences:
    thresholds:
      warning: 3
      critical: 5
  tardy_rate:
    thresholds:
      warning: 0.15
      critical: 0.20
  partial_attendance:
    thresholds:
      warning: 3
      critical: 6
    window: 30d
  onboarding_grace_days: 7
  limited_schedule_threshold: 3   # classes/week triggers absolute counts
```

Store under `attendance_rules` in `config/rules.yaml`; allow overrides by campus (e.g., `campus_overrides: { campus_id: { absence_rate_term: { warning: 0.18 }}}`).
