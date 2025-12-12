# AI Data Integrity Monitor – Link Consistency & Required Field Rules

Generated: 2025-11-19  
Sources: ContextPrime (`ChatGPT_Master_Prompt.md`), CHE guides, `docs/prompt-1-schema-spec.md`, `docs/prompt-2-architecture-plan.md`.

## A. Human-Readable Rule List

### 1. Student Relationships
- **Student ↔ Parent**
  - Every active Student must have ≥1 linked Parent/Guardian with `status = active`.
  - Each linked Parent record must reference back to at least one active Student; flag orphans.
  - Guardians flagged as “Primary Contact” must have valid email or phone.
- **Student ↔ Campus**
  - Exactly one primary Campus link for active students.
  - Optional secondary campuses must have `is_secondary = true`.
  - Campus must be active and match student’s timezone.
- **Student ↔ Class / Truth**
  - Students enrolled this term must have ≥1 Class enrollment whose campus matches Student’s campus and term overlaps Student enrollment dates.
  - Each enrolled Student must link to a Truth record; link must not be archived.
  - Student-Class link requires Attendance records only within active enrollment dates.

### 2. Parent Relationships
- **Parent ↔ Student**
  - Parents marked `is_active` must have ≥1 linked Student.
  - Relationship role (Mother/Father/Guardian) must be set for each linked student.
  - Parents cannot link to archived Students unless `status = alumni`.

### 3. Contractor Relationships
- **Contractor ↔ Class / Campus**
  - Active Classes must link to exactly one primary Contractor; additional assistants allowed but flagged if >3 without justification.
  - Contractor must be assigned to at least one campus when active.
  - Contractors cannot be assigned to classes outside their active date range.

### 4. Class Relationships
- **Class ↔ Campus**
  - Each Class must link to one campus; campus must be active.
  - Term + schedule must align with campus calendar (start/end overlap).
- **Class ↔ Students**
  - Classes flagged `status = active` should have ≥1 enrolled student or be marked `is_empty_ok = true`.

### 5. Attendance Relationships
- Each Attendance row must link to Student AND Class.
- Student must be enrolled in that Class at attendance date; otherwise flag.
- Duplicate (student, class, date) combinations are invalid.

### 6. Truth & Payment Relationships
- Truth record must link to Students and (if applicable) Payment/Enrollment records.
- Payment entries referencing Students must also link to the corresponding Truth ID.

### 7. Required Fields per Entity
- **Student**
  - `truth_id`, `enrollment_status`, `primary_contact_method`, `grade_level`, `primary_campus`, `emergency_contact_ack`.
- **Parent**
  - `relationship_role`, at least one contact method (email/phone), `mailing_address` (if billing contact).
- **Contractor**
  - `legal_name`, `email`, `phone`, `campus_assignment`, `onboarding_status`, `ein` (if paid).
- **Class**
  - `term`, `schedule`, `campus`, `primary_contractor`, `capacity`.
- **Attendance**
  - `date`, `status`, `minutes_attended` (or reason if absent), `class_link`, `student_link`.
- **Payment**
  - `amount`, `invoice_status`, `linked_student_or_parent`, `truth_id` (if required), `payment_method`.

Violations should include remediation hints (e.g., “Link at least one active Parent”).

## B. Machine-Readable Config Example

```yaml
entities:
  students:
    required_fields:
      - field: truth_id
        severity: critical
        message: "Student must link to a Truth record."
      - field: enrollment_status
        severity: warning
        message: "Set enrollment status before classes start."
      - field: primary_contact_method
        severity: warning
        message: "Need email or phone for outreach."
    relationships:
      parents:
        min: 1
        status_field: parent.status
        require_active: true
        missing_message: "Add at least one active parent/guardian."
      campus:
        min: 1
        max: 1
        require_active: true
        message: "Students must have exactly one primary campus."
      classes:
        min_if:
          field: enrollment_status
          equals: "enrolled"
        message: "Enrolled students need at least one active class."
      truth:
        min: 1
        require_active: true
        message: "Truth link required."

  parents:
    required_fields:
      - field: relationship_role
        severity: warning
      - field: email
        severity: warning
        alternate_field: phone
        message: "Need at least one contact method."
    relationships:
      students:
        min: 1
        require_active: true
        message: "Active parents must connect to a student."

  contractors:
    required_fields:
      - field: legal_name
      - field: email
      - field: phone
      - field: onboarding_status
      - field: ein
        condition:
          field: compensation_type
          equals: "paid"
    relationships:
      campus:
        min: 1
        message: "Active contractors must have a campus assignment."
      classes:
        max: 10
        message: "Review contractors teaching more than 10 classes."

  classes:
    required_fields:
      - field: term
      - field: schedule
      - field: campus
      - field: primary_contractor
    relationships:
      campus:
        min: 1
      contractor:
        min: 1
        max: 1
        message: "Classes must have exactly one primary instructor."
      students:
        min: 1
        allow_if_flag: is_empty_ok

  attendance:
    required_fields:
      - field: date
      - field: status
      - field: minutes
        alternate_field: absence_reason
    relationships:
      student:
        min: 1
      class:
        min: 1
      enrollment:
        rule: "student must belong to class on date"

  payments:
    required_fields:
      - field: amount
      - field: invoice_status
      - field: linked_entity
      - field: truth_id
        condition:
          field: requires_truth
          equals: true
    relationships:
      student_or_parent:
        min: 1
```

### Config Usage Notes
- `condition` blocks allow required fields that depend on another field value.
- `alternate_field` indicates at least one of the listed fields must be present.
- Relationship config supports min/max counts, active-status requirements, and conditional checks based on entity fields.
- Store YAML under `backend/config/rules.yaml`; loader maps to dataclasses for validation.
