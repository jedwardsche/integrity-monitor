/**
 * Utilities for generating Airtable deep links.
 */

const BASE_MAPPINGS: Record<string, string> = {
  students: import.meta.env.VITE_AIRTABLE_STUDENTS_BASE || "",
  parents: import.meta.env.VITE_AIRTABLE_PARENTS_BASE || "",
  contractors: import.meta.env.VITE_AIRTABLE_CONTRACTORS_BASE || "",
  data_issues: import.meta.env.VITE_AIRTABLE_DATA_ISSUES_BASE || "",
};

const TABLE_MAPPINGS: Record<string, string> = {
  students: import.meta.env.VITE_AIRTABLE_STUDENTS_TABLE || "",
  parents: import.meta.env.VITE_AIRTABLE_PARENTS_TABLE || "",
  contractors: import.meta.env.VITE_AIRTABLE_CONTRACTORS_TABLE || "",
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
 * Generate an Airtable deep link using entity type mapping.
 * @param entity - Entity type (students, parents, contractors, etc.)
 * @param recordId - Airtable record ID
 * @returns URL to the record, or null if mapping not found
 */
export function getAirtableLinkByEntity(entity: string, recordId: string): string | null {
  const baseId = BASE_MAPPINGS[entity.toLowerCase()];
  const tableId = TABLE_MAPPINGS[entity.toLowerCase()];

  if (!baseId || !tableId) {
    return null;
  }

  return getAirtableRecordLink(baseId, tableId, recordId);
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
