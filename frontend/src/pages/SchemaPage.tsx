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
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "SchemaPage.tsx:15",
      message: "fetchJson called",
      data: { url, path, apiBase: API_BASE, hasToken: !!token },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "schema-fetch",
      hypothesisId: "H7",
    }),
  }).catch(() => {});
  // #endregion agent log
  const response = await fetch(url, { cache: "no-store", headers });
  const contentType = response.headers.get("content-type") || "";
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "SchemaPage.tsx:18",
      message: "Response received",
      data: {
        url,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType,
        isJson: contentType.includes("application/json"),
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "schema-fetch",
      hypothesisId: "H8",
    }),
  }).catch(() => {});
  // #endregion agent log
  if (!response.ok || !contentType.includes("application/json")) {
    const message = await response.text();
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "SchemaPage.tsx:21",
        message: "Response is not JSON",
        data: {
          url,
          status: response.status,
          contentType,
          messagePreview: message.substring(0, 200),
          isHtml: message.trim().startsWith("<"),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "schema-fetch",
        hypothesisId: "H8",
      }),
    }).catch(() => {});
    // #endregion agent log
    const errorMessage =
      message && message.trim().startsWith("<")
        ? `Expected JSON but received HTML from ${url}. This usually means:\n1. VITE_API_BASE is not set correctly in production (should point to Cloud Run backend URL)\n2. The backend is not running or not accessible\n3. Firebase Hosting is serving the SPA instead of proxying to the backend\n\nCurrent API_BASE: ${API_BASE}\nVITE_API_BASE env: ${
            import.meta.env.VITE_API_BASE || "not set"
          }\n\nTo fix: Rebuild the frontend using frontend/build-with-secrets.sh which will set VITE_API_BASE to the correct Cloud Run URL.`
        : message || `Request failed (${response.status}) for ${url}`;
    throw new Error(errorMessage);
  }
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "SchemaPage.tsx:27",
      message: "Parsing JSON response",
      data: { url, contentType },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "schema-fetch",
      hypothesisId: "H8",
    }),
  }).catch(() => {});
  // #endregion agent log
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
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "SchemaPage.tsx:58",
              message: "Loading summary",
              data: { apiBase: API_BASE, user: !!user },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "schema-summary",
              hypothesisId: "H7",
            }),
          }
        ).catch(() => {});
        // #endregion agent log
        const data = await fetchJson<AirtableSummary>(
          "/airtable/schema/summary"
        );
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "SchemaPage.tsx:62",
              message: "Summary loaded successfully",
              data: { hasData: !!data },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "schema-summary",
              hypothesisId: "H7",
            }),
          }
        ).catch(() => {});
        // #endregion agent log
        setSummary(data);
      } catch (error) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/5d5f825f-e8a4-412f-af68-47be30198b26",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "SchemaPage.tsx:66",
              message: "Summary load failed",
              data: {
                error: error instanceof Error ? error.message : String(error),
                hasSchema: !!schema,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "schema-summary",
              hypothesisId: "H7",
            }),
          }
        ).catch(() => {});
        // #endregion agent log
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
