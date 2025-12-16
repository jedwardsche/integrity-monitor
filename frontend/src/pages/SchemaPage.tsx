import { useEffect, useMemo, useState } from "react";
import { AirtableSchemaView } from "../components/AirtableSchemaView";
import { deriveSummaryFromSchema } from "../utils/airtable";
import type { AirtableSchema, AirtableSummary } from "../utils/airtable";
import { useAuth } from "../hooks/useAuth";

import { API_BASE } from "../config/api";

async function fetchJson<T>(path: string, token?: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, { cache: "no-store", headers });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) {
    const message = await response.text();
    throw new Error(
      message && message.trim().startsWith("<")
        ? `Expected JSON but received HTML from ${url}. Is the backend running at VITE_API_BASE?`
        : message || `Request failed (${response.status}) for ${url}`
    );
  }
  return (await response.json()) as T;
}

async function fetchLocalSchema(): Promise<AirtableSchema> {
  const response = await fetch("/airtable-schema.json", { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Local airtable-schema.json not found.");
  }
  return (await response.json()) as AirtableSchema;
}

export function SchemaPage() {
  const [schema, setSchema] = useState<AirtableSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [summary, setSummary] = useState<AirtableSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const { getToken, user, loading: authLoading } = useAuth();

  // Toast notification handler (no-op - toasts handled globally in App.tsx)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addToast = (message: string, type: "success" | "error" | "info") => {
    // Toasts are handled globally, this is just a placeholder for AirtableSchemaView
  };

  useEffect(() => {
    // Don't load data until auth is ready
    if (authLoading) return;

    const loadSummary = async () => {
      try {
        const data = await fetchJson<AirtableSummary>(
          "/airtable/schema/summary"
        );
        setSummary(data);
      } catch (error) {
        setSummaryError(error instanceof Error ? error.message : String(error));
        // If schema is already present, derive a local summary as a fallback.
        if (schema) {
          setSummary(deriveSummaryFromSchema(schema));
        }
      } finally {
        setSummaryLoading(false);
      }
    };

    const loadSchema = async () => {
      try {
        // Only try to get token if user is authenticated
        const token = user ? await getToken() : null;
        const data = await fetchJson<AirtableSchema>(
          "/airtable/schema",
          token || undefined
        );
        setSchema(data);

        // Auto-discover table IDs after schema loads successfully
        if (token && data) {
          try {
            const response = await fetch(
              `${API_BASE}/airtable/schema/discover-table-ids`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                const updatedCount = Object.values(
                  result.updates?.env || {}
                ).filter((v: any) => v).length;
                if (updatedCount > 0) {
                  addToast(
                    `Discovered and updated ${updatedCount} table ID${
                      updatedCount > 1 ? "s" : ""
                    }`,
                    "success"
                  );
                }
              }
            }
          } catch (discoveryError) {
            // Don't show error for auto-discovery failures - it's non-critical
            console.debug("Table ID auto-discovery failed:", discoveryError);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSchemaError(message);
        // Fallback to the static file if API fetch fails.
        try {
          const local = await fetchLocalSchema();
          setSchema(local);
          setSchemaError(null);
          // If summary failed, derive from local schema.
          setSummary((prev) => prev || deriveSummaryFromSchema(local));
        } catch (fallbackError) {
          setSchemaError(
            message +
              " | Fallback failed: " +
              (fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError))
          );
        }
      } finally {
        setSchemaLoading(false);
      }
    };

    loadSummary();
    loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]); // Re-run when auth state changes

  const schemaTotals = useMemo(() => {
    if (summary) {
      return {
        tables: summary.tableCount,
        fields: summary.fieldCount,
        records: summary.recordCount,
      };
    }
    if (!schema) return { tables: 0, fields: 0, records: 0 };
    const tables = schema.tables.length;
    const fields = schema.tables.reduce(
      (sum, table) => sum + (table.fieldCount || 0),
      0
    );
    const records = schema.tables.reduce(
      (sum, table) => sum + (table.recordCount || 0),
      0
    );
    return { tables, fields, records };
  }, [schema, summary]);

  return (
    <AirtableSchemaView
      schema={schema}
      schemaError={schemaError}
      schemaLoading={schemaLoading}
      schemaTotals={schemaTotals}
      summary={summary}
      summaryError={summaryError}
      summaryLoading={summaryLoading}
      onToast={addToast}
    />
  );
}
