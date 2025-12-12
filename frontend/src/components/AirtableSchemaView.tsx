import { useState } from "react";
import type { AirtableSchema, AirtableSummary } from "../utils/airtable";
import { BaseDownloadMenu } from "./BaseDownloadMenu";
import { DataDownloadMenu } from "./DataDownloadMenu";
import {
  downloadJson,
  downloadCsv,
  createZipFile,
  dataToJsonString,
  dataToCsvString,
  type ZipFile,
} from "../utils/download";
import { useAuth } from "../hooks/useAuth";

export type DownloadProgress = {
  current: string; // Current operation description
  total: number; // Total number of operations
  completed: number; // Number completed
  errors: string[]; // List of error messages
  files: Array<{ name: string; size: number }>; // Files prepared
};

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  window.location.origin;

type AirtableSchemaViewProps = {
  schema: AirtableSchema | null;
  schemaError: string | null;
  schemaLoading: boolean;
  schemaTotals: { tables: number; fields: number; records: number };
  summary: AirtableSummary | null;
  summaryError: string | null;
  summaryLoading: boolean;
  onToast?: (message: string, type: "success" | "error" | "info") => void;
};

export function AirtableSchemaView({
  schema,
  schemaError,
  schemaLoading,
  schemaTotals,
  summary,
  summaryError,
  summaryLoading,
  onToast,
}: AirtableSchemaViewProps) {
  const { getToken } = useAuth();
  const baseId = summary?.baseId || schema?.baseId;
  const fetchedAt = summary?.fetchedAt || schema?.fetchedAt;
  const summaryPath = summary?.path;
  const FIELD_DISPLAY_LIMIT = 25;

  const [dataDownloadMenuOpen, setDataDownloadMenuOpen] = useState<
    string | null
  >(null);
  const [baseDownloadMenuOpen, setBaseDownloadMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchTableRecords = async (tableId: string) => {
    if (!baseId) {
      onToast?.("Base ID not available", "error");
      return null;
    }

    const token = await getToken();
    if (!token) {
      onToast?.("Authentication required", "error");
      return null;
    }

    const response = await fetch(`${API_BASE}/airtable/records/${tableId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Request failed (${response.status})`);
    }

    const data = await response.json();
    return data.records || [];
  };

  const handleDownloadTableDataCsv = async (tableId: string) => {
    setIsDownloading(true);
    try {
      const records = await fetchTableRecords(tableId);
      if (!records) return;

      if (records.length === 0) {
        onToast?.("No records found in this table", "info");
        return;
      }

      const table = schema?.tables.find((t) => t.id === tableId);
      const tableName = table?.name || tableId;
      const sanitizedName = tableName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      downloadCsv(records, `${sanitizedName}_data`);
      onToast?.(
        `Downloaded ${records.length} records from ${tableName}`,
        "success"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onToast?.(`Failed to download data: ${message}`, "error");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadTableDataJson = async (tableId: string) => {
    setIsDownloading(true);
    try {
      const records = await fetchTableRecords(tableId);
      if (!records) return;

      if (records.length === 0) {
        onToast?.("No records found in this table", "info");
        return;
      }

      const table = schema?.tables.find((t) => t.id === tableId);
      const tableName = table?.name || tableId;
      const sanitizedName = tableName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      downloadJson(records, `${sanitizedName}_data`);
      onToast?.(
        `Downloaded ${records.length} records from ${tableName}`,
        "success"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onToast?.(`Failed to download data: ${message}`, "error");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadTableSchema = (tableId: string) => {
    if (!schema) {
      onToast?.("Schema not available", "error");
      return;
    }

    const table = schema.tables.find((t) => t.id === tableId);
    if (!table) {
      onToast?.("Table not found", "error");
      return;
    }

    // Extract only schema information, no record data
    const schemaOnly = {
      id: table.id,
      name: table.name,
      description: table.description,
      primaryFieldId: table.primaryFieldId,
      fields: table.fields.map((field) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        options: field.options,
      })),
    };

    const sanitizedName = table.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    downloadJson(schemaOnly, `${sanitizedName}_schema`);
    onToast?.(`Downloaded schema for ${table.name}`, "success");
  };

  const handleBaseDownload = async (
    options: {
      tableIds: string[];
      downloadTypes: ("tableIds" | "schema" | "data")[];
    },
    onProgress?: (progress: DownloadProgress) => void
  ) => {
    if (!schema || !baseId) {
      onToast?.("Schema or base ID not available", "error");
      return;
    }

    setIsDownloading(true);
    const files: ZipFile[] = [];
    const errors: string[] = [];
    let completed = 0;

    try {
      const token = await getToken();
      if (!token && options.downloadTypes.includes("data")) {
        onToast?.("Authentication required for data downloads", "error");
        setIsDownloading(false);
        return;
      }

      const selectedTables = schema.tables.filter((t) =>
        options.tableIds.includes(t.id)
      );

      // Calculate total operations
      let totalOps = 0;
      if (options.downloadTypes.includes("tableIds")) totalOps += 1;
      if (options.downloadTypes.includes("schema")) totalOps += 1;
      if (options.downloadTypes.includes("data"))
        totalOps += selectedTables.length;

      // Process tableIds
      if (options.downloadTypes.includes("tableIds")) {
        onProgress?.({
          current: "Preparing table IDs...",
          total: totalOps,
          completed,
          errors,
          files: files.map((f) => ({ name: f.name, size: 0 })),
        });

        const tableIdsData = selectedTables.map((t) => ({
          id: t.id,
          name: t.name,
          recordCount: t.recordCount,
          fieldCount: t.fieldCount,
        }));
        const content = dataToJsonString({ baseId, tables: tableIdsData });
        files.push({
          name: "table_ids",
          content,
          type: "json",
        });
        completed++;
        onProgress?.({
          current: "Table IDs prepared",
          total: totalOps,
          completed,
          errors,
          files: files.map((f) => ({
            name: f.name,
            size: typeof f.content === "string" ? f.content.length : 0,
          })),
        });
      }

      // Process schema
      if (options.downloadTypes.includes("schema")) {
        onProgress?.({
          current: "Preparing schema...",
          total: totalOps,
          completed,
          errors,
          files: files.map((f) => ({
            name: f.name,
            size: typeof f.content === "string" ? f.content.length : 0,
          })),
        });

        const schemaData = {
          baseId,
          fetchedAt: schema.fetchedAt,
          tables: selectedTables.map((table) => ({
            id: table.id,
            name: table.name,
            description: table.description,
            primaryFieldId: table.primaryFieldId,
            fields: table.fields.map((field) => ({
              id: field.id,
              name: field.name,
              type: field.type,
              options: field.options,
            })),
          })),
        };
        const content = dataToJsonString(schemaData);
        files.push({
          name: "schema",
          content,
          type: "json",
        });
        completed++;
        onProgress?.({
          current: "Schema prepared",
          total: totalOps,
          completed,
          errors,
          files: files.map((f) => ({
            name: f.name,
            size: typeof f.content === "string" ? f.content.length : 0,
          })),
        });
      }

      // Process data
      if (options.downloadTypes.includes("data") && token) {
        for (const table of selectedTables) {
          onProgress?.({
            current: `Fetching data for ${table.name}...`,
            total: totalOps,
            completed,
            errors,
            files: files.map((f) => ({
              name: f.name,
              size: typeof f.content === "string" ? f.content.length : 0,
            })),
          });

          try {
            const response = await fetch(
              `${API_BASE}/airtable/records/${table.id}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!response.ok) {
              const error = await response.text();
              throw new Error(error || `Request failed (${response.status})`);
            }

            const data = await response.json();
            const records = data.records || [];

            if (records.length > 0) {
              const sanitizedName = table.name
                .replace(/[^a-z0-9]/gi, "_")
                .toLowerCase();
              const content = dataToCsvString(records);
              files.push({
                name: `${sanitizedName}_data`,
                content,
                type: "csv",
              });
            }
            completed++;
            onProgress?.({
              current: `Data for ${table.name} prepared`,
              total: totalOps,
              completed,
              errors,
              files: files.map((f) => ({
                name: f.name,
                size: typeof f.content === "string" ? f.content.length : 0,
              })),
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            errors.push(`${table.name}: ${message}`);
            completed++;
            onProgress?.({
              current: `Error fetching ${table.name}`,
              total: totalOps,
              completed,
              errors,
              files: files.map((f) => ({
                name: f.name,
                size: typeof f.content === "string" ? f.content.length : 0,
              })),
            });
          }
        }
      }

      // Download files
      if (files.length === 0) {
        onToast?.("No files to download", "info");
        return;
      }

      onProgress?.({
        current: "Creating download package...",
        total: totalOps,
        completed,
        errors,
        files: files.map((f) => ({
          name: f.name,
          size: typeof f.content === "string" ? f.content.length : 0,
        })),
      });

      if (files.length === 1) {
        // Single file - download directly
        const file = files[0];
        if (file.type === "json") {
          downloadJson(JSON.parse(file.content as string), file.name);
        } else {
          // For CSV, create a blob from the string
          const blob = new Blob([file.content as string], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${file.name}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } else {
        // Multiple files - create ZIP
        await createZipFile(files, `base_${baseId}_download`);
      }

      onProgress?.({
        current: "Download complete",
        total: totalOps,
        completed,
        errors,
        files: files.map((f) => ({
          name: f.name,
          size: typeof f.content === "string" ? f.content.length : 0,
        })),
      });

      const successMsg =
        files.length === 1
          ? `Downloaded ${files[0].name}`
          : `Downloaded ${files.length} files as ZIP`;
      onToast?.(successMsg, "success");
      if (errors.length > 0) {
        onToast?.(
          `${errors.length} error(s) occurred. Check details in download status.`,
          "error"
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      onProgress?.({
        current: "Download failed",
        total: 0,
        completed: 0,
        errors,
        files: [],
      });
      onToast?.(`Failed to download: ${message}`, "error");
    } finally {
      setIsDownloading(false);
      // Don't close menu immediately - let user see the final status
      setTimeout(() => {
        setBaseDownloadMenuOpen(false);
      }, 2000);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_30px_60px_rgba(31,79,72,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Airtable
            </p>
            <p
              className="text-2xl font-semibold text-[var(--text-main)]"
              style={{ fontFamily: "Outfit" }}
            >
              Base schema + record coverage
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Pulled from backend/config/airtable_schema.json. Regenerate
              anytime the base changes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/70 px-4 py-2 text-sm">
              {baseId ? `Base ${baseId}` : "Base not loaded"}
            </div>
            {schema && baseId && (
              <button
                onClick={() => setBaseDownloadMenuOpen(true)}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-mid)]/50 transition-colors"
              >
                Download Base
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/60 p-4">
            <p className="text-xs text-[var(--text-muted)]">Tables</p>
            <p
              className="text-3xl font-semibold"
              style={{ fontFamily: "Outfit" }}
            >
              {schemaTotals.tables}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/60 p-4">
            <p className="text-xs text-[var(--text-muted)]">Fields</p>
            <p
              className="text-3xl font-semibold"
              style={{ fontFamily: "Outfit" }}
            >
              {schemaTotals.fields}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/60 p-4">
            <p className="text-xs text-[var(--text-muted)]">Records</p>
            <p
              className="text-3xl font-semibold"
              style={{ fontFamily: "Outfit" }}
            >
              {schemaTotals.records}
            </p>
          </div>
        </div>
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          {fetchedAt
            ? `Last fetched ${new Date(fetchedAt).toLocaleString()}`
            : "Schema not generated yet."}
          {summaryPath ? ` • Source: ${summaryPath}` : null}
        </div>
      </section>

      {summaryLoading ? (
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 text-[var(--text-muted)]">
          Loading summary…
        </div>
      ) : summaryError ? (
        <div className="rounded-3xl border border-[#f8d7da] bg-[#fff5f7] p-6 text-[#a61b2b]">
          {summaryError}. Confirm the backend is running and the schema JSON
          exists.
        </div>
      ) : summary ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Top by records
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {summary.topRecordTables.map((table) => (
                  <li
                    key={table.id || table.name}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/60 px-3 py-2"
                  >
                    <span className="font-medium text-[var(--text-main)]">
                      {table.name || table.id}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {table.recordCount ?? 0} records
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Top by fields
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {summary.topFieldTables.map((table) => (
                  <li
                    key={table.id || table.name}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/60 px-3 py-2"
                  >
                    <span className="font-medium text-[var(--text-main)]">
                      {table.name || table.id}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {table.fieldCount ?? 0} fields
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {summary.fieldTypeBreakdown.length > 0 && (
            <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Field types
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                {summary.fieldTypeBreakdown.map((entry) => (
                  <span
                    key={entry.type}
                    className="rounded-full bg-[var(--bg-mid)] px-3 py-1"
                  >
                    {entry.type}: {entry.count}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      {schemaLoading ? (
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 text-[var(--text-muted)]">
          Loading schema…
        </div>
      ) : schemaError ? (
        <div className="rounded-3xl border border-[#f8d7da] bg-[#fff5f7] p-6 text-[#a61b2b]">
          {schemaError}. Confirm the backend is running and the schema JSON
          exists.
        </div>
      ) : !schema ? (
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 text-[var(--text-muted)]">
          No schema data available. Run the Airtable snapshot script to populate
          the JSON.
        </div>
      ) : (
        <section className="space-y-4">
          {schema.tables.map((table) => {
            const extraFields = Math.max(
              0,
              table.fields.length - FIELD_DISPLAY_LIMIT
            );
            return (
              <div
                key={table.id}
                className="rounded-3xl border border-[var(--border)] bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      {table.id}
                    </p>
                    <p className="text-lg font-semibold text-[var(--text-main)]">
                      {table.name}
                    </p>
                    {table.description && (
                      <p className="text-sm text-[var(--text-muted)]">
                        {table.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-mid)]/70 px-3 py-1">
                        {table.fieldCount} fields
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-mid)]/70 px-3 py-1">
                        {table.recordCount ?? 0} records
                      </span>
                      {table.earlyStopped && (
                        <span className="rounded-full border border-[var(--cta-blue)] bg-[var(--bg-mid)]/70 px-3 py-1 text-[var(--cta-blue)]">
                          Partial count
                        </span>
                      )}
                    </div>
                    <div className="relative flex gap-2">
                      <button
                        onClick={() =>
                          setDataDownloadMenuOpen(
                            dataDownloadMenuOpen === table.id ? null : table.id
                          )
                        }
                        disabled={isDownloading}
                        className="relative rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-mid)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Download Data
                      </button>
                      {dataDownloadMenuOpen === table.id && (
                        <DataDownloadMenu
                          isOpen={true}
                          onClose={() => setDataDownloadMenuOpen(null)}
                          onDownloadCsv={() =>
                            handleDownloadTableDataCsv(table.id)
                          }
                          onDownloadJson={() =>
                            handleDownloadTableDataJson(table.id)
                          }
                          isLoading={isDownloading}
                        />
                      )}
                      <button
                        onClick={() => handleDownloadTableSchema(table.id)}
                        disabled={isDownloading}
                        className="rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-mid)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Download Schema
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                  {table.fields.slice(0, FIELD_DISPLAY_LIMIT).map((field) => (
                    <span
                      key={field.id}
                      className="rounded-full bg-[var(--bg-mid)] px-3 py-1"
                    >
                      {field.name} • {field.type}
                    </span>
                  ))}
                  {extraFields > 0 && (
                    <span className="rounded-full bg-[var(--bg-mid)] px-3 py-1">
                      +{extraFields} more fields
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {schema && baseId && (
        <BaseDownloadMenu
          isOpen={baseDownloadMenuOpen}
          tables={schema.tables}
          baseId={baseId}
          onClose={() => setBaseDownloadMenuOpen(false)}
          onDownload={handleBaseDownload}
          isLoading={isDownloading}
        />
      )}
    </div>
  );
}
