# AI Data Integrity Monitor – Duplicate Detection Rules & Data Model

Generated: 2025-11-19  
Sources: ContextPrime (`ChatGPT_Master_Prompt.md`), CHE design docs, `docs/prompt-1-schema-spec.md`, `docs/prompt-2-architecture-plan.md`.

## 1. Matching Rules Per Entity

### Students
- **Blocking keys (reduce comparisons)**
  - `last_name_soundex + DOB`
  - `email_localpart + campus`
  - `normalized_phone`
- **Fields considered**
  - Legal first/middle/last name (normalized case, stripped punctuation).
  - DOB (YYYY-MM-DD).
  - Primary email (lowercase, trim aliases).
  - Primary phone (E.164 digits).
  - Parent link IDs.
  - Truth ID (if present).
- **Rule matrix**
  - **Likely duplicate** if any of:
    - Email exact match AND DOB within ±1 day.
    - Phone exact match AND last name similarity ≥0.92 (Jaro-Winkler).
    - Truth ID matches but Airtable record IDs differ.
    - Same Parent pair + DOB match.
  - **Possible duplicate** if:
    - Jaro-Winkler(full name) ≥0.94 AND DOB missing but same campus + grade.
    - Email local-part matches, domains differ by common alias (`gmail.com vs googlemail.com`).
    - Phone matches but names differ moderately (0.85–0.92) AND parents overlap.

### Parents / Guardians
- **Blocking keys**
  - `email_exact`, `phone_exact`, `last_name_soundex + zip`.
- **Fields**
  - Full name, email(s), phone(s), address, linked students, relationship role.
- **Rules**
  - **Likely duplicate**
    - Email exact match OR phone exact match.
    - Address + last name match and linked student sets overlap ≥50%.
  - **Possible duplicate**
    - Name similarity ≥0.9 with shared student + missing contact info.
    - Phone normalized matches but marked inactive on one record.
    - Household address exact match + same relationship role (e.g., two "Mother" records).

### Contractors / Instructors
- **Blocking keys**
  - `legal_name_soundex + campus`, `email_exact`, `ein`.
- **Fields**
  - Legal name, preferred name, email, phone, vendor EIN/business ID, campus assignments, certification ID.
- **Rules**
  - **Likely duplicate**
    - EIN or business ID matches.
    - Email matches OR phone matches AND name similarity ≥0.9.
  - **Possible duplicate**
    - Name similarity ≥0.92 with overlapping campus assignments.
    - Certification/license number matches but contact info missing.

## 2. Fuzzy Matching Approach

### Normalization Steps
1. **Names**
   - Trim, lower, remove diacritics, collapse whitespace.
   - Create phonetic tokens (Soundex or Double Metaphone) for blocking.
2. **Emails**
   - Lowercase, trim.
   - For Gmail-like domains remove dots and text after `+` in local part.
3. **Phones**
   - Strip non-digits, enforce country code (default `+1`), format E.164.
4. **Addresses**
   - Uppercase, abbreviate common words (Street→St), remove punctuation.
5. **Dates**
   - ISO format, handle missing leading zeros.

### Similarity Metrics
- **Jaro-Winkler** for names (handles transpositions, nicknames).
- **Levenshtein ratio** for emails/local parts.
- **Exact match** for normalized phone/email/EIN.
- **Jaccard** for set-based comparisons (shared parent/student lists).

### Thresholds
- Student names:
  - Likely: ≥0.94, Possible: 0.88–0.94.
- Parent names:
  - Likely: ≥0.92, Possible: 0.85–0.92 with supporting data.
- Contractor names:
  - Likely: ≥0.92 when combined with campus overlap.
- Jaccard shared-parent/student sets:
  - Likely: ≥0.6, Possible: ≥0.4.

## 3. Duplicate Findings Data Model

### Airtable Data Issues (extended fields)
- `Issue Type`: `duplicate`.
- `Entity`: Student/Parent/Contractor (could reuse `Affected Table`).
- `Primary Record ID`: the record to keep (chosen by recency or completeness).
- `Related Record IDs`: array/linked records of duplicates.
- `Confidence`: float 0–1 (derived from similarity score mapping).
- `Evidence`: JSON string (fields compared + scores).
- `Resolution Hint`: text (e.g., “Merge emails; Truth ID identical”).

### Firestore Mirror (`integrity_issues`)
```json
{
  "issue_id": "dup.student.email_abc123",
  "entity": "student",
  "primary_record_id": "rec123",
  "related_record_ids": ["rec456", "rec789"],
  "confidence": 0.97,
  "severity": "warning",
  "evidence": {
    "email": "match",
    "name_similarity": 0.96,
    "dob_delta_days": 0
  },
  "status": "open",
  "last_seen": "2025-11-19T09:14:00Z"
}
```

### Duplicate Grouping
- Assign `duplicate_group_id` (UUID) per cluster.
- Mark which record is `primary` (maybe highest completeness score).
- Additional metrics: `group_size`, `has_conflict_fields` booleans.

## 4. Pseudo-Code Outline

```python
def run_duplicate_checks(entity_name, records, rules, thresholds):
    normalized = [normalize_record(r, entity_name) for r in records]
    blocks = bucket_records(normalized, rules.block_keys)
    findings = []

    for key, bucket in blocks.items():
        for rec_a, rec_b in combinations(bucket, 2):
            evidence = compare(rec_a, rec_b, rules)
            confidence = score(evidence, thresholds)
            match_type = classify(confidence, thresholds)

            if match_type in {"likely", "possible"}:
                group_id = upsert_duplicate_group(rec_a, rec_b, match_type, evidence)
                findings.append(build_issue(entity_name, rec_a, rec_b, group_id, match_type, confidence, evidence))

    return findings
```

Helper responsibilities:
- `normalize_record`: apply field-specific normalization (names, emails, phones, etc.).
- `bucket_records`: create blocking keys (soundex, email local part) to reduce pair comparisons.
- `compare`: compute field-level similarities (Jaro-Winkler, exact match, Jaccard).
- `score`: convert evidence to 0–1 confidence (weighted sum; e.g., email exact = 0.6, name similarity ×0.3, DOB match bonus 0.1).
- `classify`: map confidence to `likely` / `possible` thresholds.
- `upsert_duplicate_group`: check if either record already belongs to an existing duplicate group (via Airtable or in-memory) and merge accordingly.
- `build_issue`: shape data for Airtable/Firestore writers following schema from prompt 2.

## 5. Implementation Notes

- Store normalization + weight configuration in `config/rules.yaml` so thresholds per entity can be tuned without code changes.
- Support incremental detection by tracking `duplicate_group_id` in Data Issues; if group resolved (status != open) re-open when re-detected.
- Log metrics per run: total pairs evaluated, duplicates detected by entity, average confidence.
