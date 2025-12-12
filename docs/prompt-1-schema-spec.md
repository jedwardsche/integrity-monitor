# AI Data Integrity Monitor – Schema & Anomaly Definitions

Generated: 2025-11-19

## 1. Core Entities & Key Identifiers

- **Students**
  - Primary IDs: `student_id` (Airtable record ID), `truth_id` (external), district `student_code`.
  - Identity fields: legal first/middle/last name, preferred name, DOB, primary email, phone, campus.
  - Relationships: linked Parents/Guardians, Classes, Truth record, Campus, Attendance entries, Payment/Enrollment records.
- **Parents / Guardians**
  - IDs: `parent_id`, email, phone number.
  - Fields: full name, relationship to student, preferred contact method, address, portal account ID.
  - Links: Students, Payments/Billing contacts.
- **Contractors / Instructors**
  - IDs: `contractor_id`, email, phone.
  - Fields: legal name, specialization, vendor EIN, campus assignments.
  - Links: Classes taught, Attendance approvals.
- **Classes / Sections**
  - IDs: `class_id`, term, schedule block.
  - Fields: course name, campus, instructor, capacity.
  - Links: Enrolled Students, Attendance, Campus, Truth course mapping.
- **Attendance Records**
  - IDs: `attendance_id`, date, class_id, student_id.
  - Fields: status (present/absent/tardy), minutes attended, notes/reason codes.
- **Truth Records**
  - IDs: `truth_id`.
  - Fields: canonical enrollment/student profile shared across systems.
  - Links: Students, Classes, Payments.
- **Campuses / Sites**
  - IDs: `campus_id`.
  - Fields: name, address, timezone, schedule template.
  - Links: Students, Classes, Contractors.
- **Payments / Billing**
  - IDs: `payment_id`.
  - Fields: linked Student or Parent, invoice status, method, Truth linkage.
- **Data Issues (new table)**
  - IDs: `issue_id`.
  - Fields: affected table/record, issue type, severity, description, rule key, status, timestamps.

## 2. Duplicate Definitions

- **Students**
  - Likely duplicate when ≥2 of:
    - Normalized full name + DOB match.
    - Email match after lowercase/trim.
    - Phone match after stripping punctuation.
    - Same Parent link(s) combined with same campus or Truth ID missing.
  - Possible duplicate when name + one contact field match or name + campus + same enrollment dates.
- **Parents**
  - Likely duplicate when email matches exactly OR phone matches exactly and names are a close phonetic match.
  - Possible duplicate when first+last name + shared student link overlap but contact fields differ.
  - Consider household address + relationship role as supporting evidence.
- **Contractors**
  - Likely duplicate when legal name + email OR legal name + phone match.
  - Detect vendor duplicates via EIN or business name similarity.
  - Possible duplicate when same campus assignments and overlapping phone/last name combos.

## 3. Missing / Broken Link Definitions

- **Student ↔ Parent**
  - Violation if Student lacks at least one active Parent/Guardian link (or all linked parents marked inactive).
  - Violation if Parent references Students that no longer exist (or are archived).
- **Student ↔ Campus**
  - Each active Student must link to exactly one primary Campus; flag missing or multiple active campus links.
  - Broken if campus reference points to inactive/archived campus.
- **Student ↔ Class**
  - Enrolled Students require ≥1 Class (per term rules) with matching campus/term; missing link or mismatched term is a violation.
  - Detect orphaned Class enrollments referencing non-existent Students.
- **Student ↔ Truth**
  - Every active Student needs a Truth record; missing Truth ID or Truth link pointing to inactive record is broken.
- **Class ↔ Contractor**
  - Each live Class needs an assigned instructor/contractor; missing or inactive contractor link is an issue.
- **Attendance ↔ Student/Class**
  - Each Attendance record must reference valid Student & Class; flag when either link missing or mismatched (e.g., student not enrolled in class).
- **Payment ↔ Student/Truth**
  - Payment entries must link to either Student or Parent and reference correct Truth/enrollment record; missing link or mismatched status is an anomaly.

## 4. Missing Key Data Definitions

- **Students**
  - Missing Truth ID.
  - No primary contact method (email or phone).
  - No enrollment status or grade level.
  - Missing payment linkage when tuition-required.
  - No emergency contact acknowledgement.
- **Parents**
  - Missing both email and phone.
  - Missing relationship role or preferred contact flag.
  - No address for billing-required guardians.
- **Contractors**
  - Missing onboarding status, compliance docs, or vendor EIN for paid instructors.
  - No campus assignment despite active classes.
- **Classes**
  - Missing schedule (days/times), term, capacity, or campus.
  - Missing assigned instructor.
- **Attendance**
  - Missing status value, minutes attended, or absence reason when marked absent.
  - Missing date or duplicate date+student+class combination.
- **Payments**
  - Missing invoice status, amount, or linkage to Student/Parent.
  - Missing Truth reference where required for reconciliation.
- **Data Issues**
  - Missing rule ID or severity prevents deduplication — treat as system error.

Use these definitions as guardrails when implementing the checking logic and when configuring rule thresholds in future prompts.
