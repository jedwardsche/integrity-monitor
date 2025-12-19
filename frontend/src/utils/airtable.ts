/**
 * Utilities for generating Airtable deep links.
 */

const BASE_MAPPINGS: Record<string, string> = {
  students: import.meta.env.VITE_AIRTABLE_STUDENTS_BASE || "",
  parents: import.meta.env.VITE_AIRTABLE_PARENTS_BASE || "",
  contractors: import.meta.env.VITE_AIRTABLE_CONTRACTORS_BASE || "",
  classes: import.meta.env.VITE_AIRTABLE_CLASSES_BASE || "",
  attendance: import.meta.env.VITE_AIRTABLE_ATTENDANCE_BASE || "",
  truth: import.meta.env.VITE_AIRTABLE_TRUTH_BASE || "",
  payments: import.meta.env.VITE_AIRTABLE_PAYMENTS_BASE || "",
  data_issues: import.meta.env.VITE_AIRTABLE_DATA_ISSUES_BASE || "",
};

const TABLE_MAPPINGS: Record<string, string> = {
  students: import.meta.env.VITE_AIRTABLE_STUDENTS_TABLE || "",
  parents: import.meta.env.VITE_AIRTABLE_PARENTS_TABLE || "",
  contractors: import.meta.env.VITE_AIRTABLE_CONTRACTORS_TABLE || "",
  classes: import.meta.env.VITE_AIRTABLE_CLASSES_TABLE || "",
  attendance: import.meta.env.VITE_AIRTABLE_ATTENDANCE_TABLE || "",
  truth: import.meta.env.VITE_AIRTABLE_TRUTH_TABLE || "",
  payments: import.meta.env.VITE_AIRTABLE_PAYMENTS_TABLE || "",
  data_issues: import.meta.env.VITE_AIRTABLE_DATA_ISSUES_TABLE || "",
};

/**
 * Generate an Airtable deep link to a specific record.
 * @param baseId - Airtable base ID
 * @param tableId - Airtable table ID
 * @param recordId - Airtable record ID
 * @returns URL to the record in Airtable
 */
export function getAirtableRecordLink(baseId: string, tableId: string, recordId: string): string {
  return `https://airtable.com/${baseId}/${tableId}/${recordId}`;
}

/**
 * Generate an Airtable link to a table (without specific record).
 * @param baseId - Airtable base ID
 * @param tableId - Airtable table ID
 * @returns URL to the table in Airtable
 */
export function getAirtableTableLink(baseId: string, tableId: string): string {
  return `https://airtable.com/${baseId}/${tableId}`;
}

/**
 * Generate an Airtable deep link using entity type mapping.
 * @param entity - Entity type (students, parents, contractors, etc.)
 * @param recordId - Airtable record ID
 * @returns URL to the record (or table if record link unavailable), or null if no mapping found
 */
export function getAirtableLinkByEntity(entity: string, recordId: string): string | null {
  if (!entity) {
    return null;
  }

  const entityLower = entity.toLowerCase();
  
  // Map singular to plural for entity names
  // Backend uses singular (student, parent, contractor) but mappings use plural
  const entityMapping: Record<string, string> = {
    // Singular forms (from backend)
    student: "students",
    parent: "parents",
    contractor: "contractors",
    // Plural forms (already correct)
    students: "students",
    parents: "parents",
    contractors: "contractors",
    // Other entities (same in singular/plural)
    classes: "classes",
    class: "classes",
    attendance: "attendance",
    truth: "truth",
    payments: "payments",
    payment: "payments",
    data_issues: "data_issues",
  };

  const mappedEntity = entityMapping[entityLower] || entityLower;
  let baseId = BASE_MAPPINGS[mappedEntity];
  let tableId = TABLE_MAPPINGS[mappedEntity];

  // Try direct lookup as fallback if mapped entity didn't work
  if (!baseId || !tableId) {
    baseId = BASE_MAPPINGS[entityLower];
    tableId = TABLE_MAPPINGS[entityLower];
  }

  // Check if we have valid (non-empty) base and table IDs
  // Empty strings from env vars mean they're not configured
  const hasValidBaseId = baseId && baseId.trim().length > 0;
  const hasValidTableId = tableId && tableId.trim().length > 0;

  if (hasValidBaseId && hasValidTableId) {
    // If we have a recordId, generate record link; otherwise return table link as fallback
    if (recordId && recordId.trim().length > 0) {
      return getAirtableRecordLink(baseId, tableId, recordId);
    }
    // Fallback to table link when recordId is missing or invalid
    return getAirtableTableLink(baseId, tableId);
  }

  // No valid mapping found - can't generate a link
  return null;
}

/**
 * Generate a link to the Data Issues table view.
 * @param filters - Optional filters (e.g., { rule_id: "dup.student.email" })
 * @returns URL to Data Issues view
 */
export function getDataIssuesLink(filters?: Record<string, string>): string {
  const baseId = BASE_MAPPINGS.data_issues || BASE_MAPPINGS.students || "";
  const tableId = TABLE_MAPPINGS.data_issues || "";

  if (!baseId || !tableId) {
    return `https://airtable.com`; // Fallback
  }

  let url = `https://airtable.com/${baseId}/${tableId}`;
  if (filters) {
    // Airtable view filters can be added as query params
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      params.append(key, value);
    });
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
  }

  return url;
}

/**
 * Generate a link to an Airtable table (base/table, without record).
 * @param baseId - Airtable base ID
 * @param tableId - Airtable table ID
 * @returns URL to the table in Airtable
 */
function getAirtableTableLink(baseId: string, tableId: string): string {
  return `https://airtable.com/${baseId}/${tableId}`;
}

/**
 * Check if a string is a valid (non-empty) ID.
 */
function isValidId(id: string | undefined): boolean {
  return !!id && id.trim() !== "";
}

/**
 * Normalize entity name from singular to plural for consistent mapping lookups.
 * @param entity - Entity name (can be singular or plural)
 * @returns Normalized plural entity name
 */
function normalizeEntityName(entity: string): string {
  const normalized = entity.toLowerCase().trim();
  // Map singular to plural
  const singularToPlural: Record<string, string> = {
    student: "students",
    parent: "parents",
    contractor: "contractors",
    class: "classes",
    classes: "classes", // already plural
  };
  return singularToPlural[normalized] || normalized;
}

/**
 * Get the shared base ID from any entity mapping.
 * Since all entities use the same base ID, we can use any available one.
 * @returns The first available base ID, or empty string if none found
 */
function getSharedBaseId(): string {
  for (const baseId of Object.values(BASE_MAPPINGS)) {
    if (isValidId(baseId)) {
      return baseId;
    }
  }
  return "";
}

/**
 * Generate Airtable links with fallback.
 * Returns an object with a primary link, falling back to any available mapping, then a generic Airtable link.
 * Priority: record link > table link > base link > generic URL
 * @param entity - Entity type (students, parents, contractors, etc.) - can be singular or plural
 * @param recordId - Airtable record ID
 * @returns Object with primary link (always returns a link, never null)
 */
export function getAirtableLinksWithFallback(
  entity: string,
  recordId: string
): { primary: string } {
  // Normalize entity name (singular → plural) for consistent mapping lookups
  const normalizedEntity = normalizeEntityName(entity);
  
  // Get shared base ID (all entities use the same base)
  const sharedBaseId = getSharedBaseId();
  
  // Get entity-specific table ID using normalized entity name
  const entityTableId = TABLE_MAPPINGS[normalizedEntity];

  // If no record ID, fallback to table link or generic URL
  if (!recordId || recordId.trim() === "") {
    if (isValidId(sharedBaseId) && isValidId(entityTableId)) {
      return { primary: getAirtableTableLink(sharedBaseId, entityTableId) };
    }
    // Try any available table as fallback
    for (const [entityKey, baseId] of Object.entries(BASE_MAPPINGS)) {
      if (isValidId(baseId)) {
        const tableId = TABLE_MAPPINGS[entityKey];
        if (isValidId(tableId)) {
          return { primary: getAirtableTableLink(baseId, tableId) };
        }
      }
    }
    return { primary: `https://airtable.com` };
  }

  // Try entity-specific record link first (using normalized entity name and shared base ID)
  if (isValidId(sharedBaseId) && isValidId(entityTableId)) {
    return { primary: getAirtableRecordLink(sharedBaseId, entityTableId, recordId) };
  }

  // Fallback: try all available mappings systematically for record links
  // First try preferred fallback entities
  const fallbackOrder = ["students", "data_issues", "parents", "contractors"];
  for (const fallbackEntity of fallbackOrder) {
    const baseId = BASE_MAPPINGS[fallbackEntity];
    const tableId = TABLE_MAPPINGS[fallbackEntity];
    if (isValidId(baseId) && isValidId(tableId)) {
      return { primary: getAirtableRecordLink(baseId, tableId, recordId) };
    }
  }

  // If no preferred mappings found, try any available mapping from BASE_MAPPINGS for record link
  for (const [entityKey, baseId] of Object.entries(BASE_MAPPINGS)) {
    if (isValidId(baseId)) {
      const tableId = TABLE_MAPPINGS[entityKey];
      if (isValidId(tableId)) {
        return { primary: getAirtableRecordLink(baseId, tableId, recordId) };
      }
    }
  }

  // Fallback to table links: try entity-specific table link
  if (isValidId(sharedBaseId) && isValidId(entityTableId)) {
    return { primary: getAirtableTableLink(sharedBaseId, entityTableId) };
  }

  // Try any available base/table combination for table link
  for (const [entityKey, baseId] of Object.entries(BASE_MAPPINGS)) {
    if (isValidId(baseId)) {
      const tableId = TABLE_MAPPINGS[entityKey];
      if (isValidId(tableId)) {
        return { primary: getAirtableTableLink(baseId, tableId) };
      }
    }
  }

  // Last resort: if we have at least a base, link to it
  if (isValidId(sharedBaseId)) {
    return { primary: `https://airtable.com/${sharedBaseId}` };
  }

  // Ultimate fallback: generic Airtable URL
  return { primary: `https://airtable.com` };
}


export type AirtableField = {
  id: string;
  name: string;
  type: string;
  options?: unknown;
};

export type AirtableTable = {
  id: string;
  name: string;
  description?: string;
  primaryFieldId?: string;
  fieldCount: number;
  recordCount?: number;
  earlyStopped?: boolean;
  fields: AirtableField[];
};

export type AirtableSchema = {
  baseId: string;
  fetchedAt: string;
  tables: AirtableTable[];
};

export type AirtableSummary = {
  baseId?: string;
  fetchedAt?: string;
  path?: string;
  tableCount: number;
  fieldCount: number;
  recordCount: number;
  fieldTypeBreakdown: { type: string; count: number }[];
  topRecordTables: { id?: string; name?: string; recordCount?: number }[];
  topFieldTables: { id?: string; name?: string; fieldCount?: number }[];
};

export function deriveSummaryFromSchema(schema: AirtableSchema): AirtableSummary {
  const tables = schema.tables || [];
  const tableCount = tables.length;
  const fieldCount = tables.reduce(
    (sum, table) => sum + (table.fieldCount || table.fields?.length || 0),
    0
  );
  const recordCount = tables.reduce(
    (sum, table) => sum + (table.recordCount || 0),
    0
  );

  const typeCounts: Record<string, number> = {};
  for (const table of tables) {
    for (const field of table.fields || []) {
      const key = field.type || "unknown";
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    }
  }

  const fieldTypeBreakdown = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const topRecordTables = [...tables]
    .sort((a, b) => (b.recordCount || 0) - (a.recordCount || 0))
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.name, recordCount: t.recordCount }));
  const topFieldTables = [...tables]
    .sort((a, b) => (b.fieldCount || 0) - (a.fieldCount || 0))
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.name, fieldCount: t.fieldCount }));

  return {
    baseId: schema.baseId,
    fetchedAt: schema.fetchedAt,
    tableCount,
    fieldCount,
    recordCount,
    path: "local airtable-schema.json",
    fieldTypeBreakdown,
    topRecordTables,
    topFieldTables,
  };
}
