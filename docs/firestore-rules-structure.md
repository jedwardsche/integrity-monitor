# Firestore Rules Document Structure

## Document Location
**Collection**: `integrity_config`  
**Document ID**: `current`

## Overview
The Firestore document `integrity_config/current` stores dynamic rule overrides that supplement the base YAML configuration files. Rules stored in Firestore take precedence over YAML rules during rule merging.

## Document Structure

```json
{
  "duplicates": {
    "students": {
      "likely": [
        {
          "rule_id": "dup.student.email_exact",
          "description": "Email exact match",
          "conditions": [
            {
              "type": "exact_match",
              "field": "primary_email"
            }
          ],
          "severity": "warning"
        }
      ],
      "possible": []
    },
    "parents": {
      "likely": [],
      "possible": []
    }
  },
  "relationships": {
    "students": {
      "parents": {
        "target": "parents",
        "message": "Students need at least one active parent/guardian.",
        "min_links": 1,
        "max_links": null,
        "require_active": true,
        "validate_bidirectional": false,
        "reverse_relationship_key": null,
        "cross_entity_validation": null
      },
      "campus": {
        "target": "campuses",
        "message": "Active students must have exactly one primary campus.",
        "min_links": 1,
        "max_links": 1,
        "require_active": true
      }
    }
  },
  "required_fields": {
    "students": [
      {
        "field": "truth_id",
        "message": "Missing Truth ID.",
        "severity": "critical",
        "alternate_fields": null,
        "condition_field": null,
        "condition_value": null
      },
      {
        "field": "primary_contact_method",
        "message": "Need at least one primary contact method.",
        "severity": "warning",
        "alternate_fields": ["primary_email", "primary_phone"],
        "condition_field": null,
        "condition_value": null
      }
    ],
    "parents": [
      {
        "field": "contact_email",
        "message": "Parents need email or phone.",
        "severity": "warning",
        "alternate_fields": ["contact_phone"]
      }
    ]
  },
  "attendance_rules": {
    "onboarding_grace_days": 7,
    "limited_schedule_threshold": 3,
    "thresholds": {
      "absence_rate_30d": {
        "info": 0.1,
        "warning": 0.15,
        "critical": 0.25
      },
      "absence_rate_term": {
        "warning": 0.2,
        "critical": 0.25
      },
      "absences_4w": {
        "warning": 5,
        "critical": 8
      },
      "consecutive_absences": {
        "warning": 3,
        "critical": 5
      },
      "consecutive_weeks_absences": {
        "warning": 2,
        "critical": 3
      },
      "tardy_rate": {
        "warning": 0.15,
        "critical": 0.2
      },
      "partial_attendance": {
        "warning": 3,
        "critical": 6
      }
    }
  },
  "metadata": {
    "last_updated": "2025-01-20T12:00:00Z",
    "updated_by": "user_id_here"
  }
}
```

## Rule Categories

### 1. Duplicates
- **Structure**: `duplicates.{entity}.{confidence}[]`
- **Entity**: Entity name (e.g., "students", "parents", "contractors")
- **Confidence**: "likely" or "possible"
- **Rule Fields**:
  - `rule_id` (string, required): Unique identifier
  - `description` (string, required): Human-readable description
  - `conditions` (array, required): List of matching conditions
  - `severity` (string): "info", "warning", or "critical"

### 2. Relationships
- **Structure**: `relationships.{entity}.{relationship_key}`
- **Entity**: Source entity name
- **Relationship Key**: Relationship identifier (e.g., "parents", "campus")
- **Rule Fields**:
  - `target` (string, required): Target entity name
  - `message` (string, required): Error message
  - `min_links` (integer): Minimum required links (default: 0)
  - `max_links` (integer, optional): Maximum allowed links
  - `require_active` (boolean): Require linked records to be active
  - `validate_bidirectional` (boolean): Check reverse links
  - `reverse_relationship_key` (string, optional): Key for reverse relationship
  - `cross_entity_validation` (object, optional): Field matching rules

### 3. Required Fields
- **Structure**: `required_fields.{entity}[]`
- **Entity**: Entity name
- **Rule Fields**:
  - `field` (string, required): Field name to check
  - `message` (string, required): Error message
  - `severity` (string): "info", "warning", or "critical"
  - `alternate_fields` (array, optional): Alternative fields that satisfy requirement
  - `condition_field` (string, optional): Conditional field name
  - `condition_value` (string, optional): Value for conditional check

### 4. Attendance Rules
- **Structure**: `attendance_rules`
- **Fields**:
  - `onboarding_grace_days` (integer): Days to ignore absences for new students
  - `limited_schedule_threshold` (integer): Minimum classes/week for limited schedule logic
  - `thresholds` (object): Metric thresholds
    - Each metric (e.g., "absence_rate_30d") contains:
      - `info` (float, optional): Info threshold
      - `warning` (float, optional): Warning threshold
      - `critical` (float, optional): Critical threshold

## Metadata
- `last_updated` (ISO 8601 string): Timestamp of last update
- `updated_by` (string, optional): User ID who made the update

## Rule Merging Logic

1. **Base Rules**: Loaded from YAML files (`schema.yaml` and `rules.yaml`)
2. **Firestore Overrides**: Loaded from `integrity_config/current`
3. **Merge Strategy**:
   - For duplicates: Firestore rules replace YAML rules for the same entity/confidence
   - For relationships: Firestore rules replace YAML rules for the same entity/relationship_key
   - For required_fields: Firestore rules replace YAML rules for the same entity
   - For attendance_rules: Firestore thresholds merge with YAML thresholds (Firestore takes precedence)

## Rule Source Indicators

Rules include a `source` field indicating their origin:
- `"yaml"`: From base YAML configuration files
- `"firestore"`: From Firestore document (dynamic override)

## Dynamic Rule Updates

- Rules are reloaded on each integrity scan
- Changes to Firestore rules take effect immediately on next scan
- Deleted rules are excluded from scans
- New rules are included in scans

## Access Control

- All rule management endpoints require Firebase authentication
- Admin permissions recommended for rule modifications
- Read access available to authenticated users
