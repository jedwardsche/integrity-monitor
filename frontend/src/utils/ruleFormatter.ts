/**
 * Utility functions for formatting rule IDs to human-readable format
 */

export function formatRuleId(ruleId: string): string {
  if (!ruleId) return ruleId;

  // Handle duplicate rules
  if (ruleId.startsWith("dup.")) {
    const parts = ruleId.split(".");
    if (parts.length >= 3) {
      const entity = parts[1]; // student, parent, contractor
      const rulePart = parts[2]; // email_dob, phone_name, etc.

      // Map rule parts to human-readable descriptions
      const ruleMap: Record<string, string> = {
        // Student rules
        email_dob: "email and date of birth",
        phone_name: "phone and name",
        parents_campus: "parents and campus",
        name_campus: "name and campus",
        parent_overlap: "parent overlap",
        truth_id: "Truth ID",
        email: "email address",
        phone: "phone number",
        name_exact: "exact name match",
        name_first_similar: "first name exact, last name similar",
        name_last_similar: "last name exact, first name similar",
        name_similar: "name similarity",
        // Parent rules
        name_student: "name and linked students",
        address: "address",
        // Contractor rules
        ein: "EIN or business ID",
        email_phone: "email and phone",
        campus_name: "campus and name",
      };

      const entityName = entity.charAt(0).toUpperCase() + entity.slice(1);
      const ruleDescription = ruleMap[rulePart] || rulePart.replace(/_/g, " ");

      return `Duplicate: ${ruleDescription}`;
    }
  }

  // Handle link rules
  if (ruleId.startsWith("link.")) {
    const parts = ruleId.split(".");
    if (parts.length >= 4) {
      const entity = parts[1];
      const relationship = parts[2];
      const issueType = parts[3]; // orphan, min, max, etc.

      const issueTypeMap: Record<string, string> = {
        orphan: "orphaned link",
        min: "missing required link",
        max: "too many links",
        inactive: "inactive link",
        bidirectional: "bidirectional mismatch",
        cross_entity_mismatch: "cross-entity mismatch",
      };

      const entityName = entity.charAt(0).toUpperCase() + entity.slice(1);
      const issueDesc = issueTypeMap[issueType] || issueType;

      return `${entityName} ${issueDesc}: ${relationship}`;
    }
  }

  // Handle required field rules
  if (ruleId.startsWith("required.")) {
    const parts = ruleId.split(".");
    if (parts.length >= 3) {
      const entity = parts[1];
      const field = parts[2];

      const entityName = entity.charAt(0).toUpperCase() + entity.slice(1);
      const fieldName = field.replace(/_/g, " ");

      return `Missing required field: ${fieldName}`;
    }
  }

  // Handle attendance rules
  if (ruleId.startsWith("attendance.")) {
    const parts = ruleId.split(".");
    if (parts.length >= 2) {
      const metric = parts[1];
      
      // Map common attendance metrics to human-readable names
      const metricMap: Record<string, string> = {
        excessive_absences: "excessive absences",
        high_absence_rate: "high absence rate",
        consecutive_absences: "consecutive absences",
        absence_threshold: "absence threshold exceeded",
      };
      
      const metricName = metricMap[metric] || metric.replace(/_/g, " ");

      return `Attendance: ${metricName}`;
    }
  }

  // Default: return as-is or format with underscores replaced
  // Capitalize first letter of each word for better readability
  const formatted = ruleId.replace(/_/g, " ").replace(/\./g, ": ");
  return formatted
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
