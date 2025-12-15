import React, { useState, useEffect } from "react";
import type { AirtableTable } from "../utils/airtable";
import type { DownloadProgress } from "./AirtableSchemaView";

interface BaseDownloadMenuProps {
  isOpen: boolean;
  tables: AirtableTable[];
  baseId: string;
  onClose: () => void;
  onDownload: (
    options: {
      tableIds: string[];
      downloadTypes: ("tableIds" | "schema" | "data")[];
    },
    onProgress?: (progress: DownloadProgress) => void
  ) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function BaseDownloadMenu({
  isOpen,
  tables,
  baseId,
  onClose,
  onDownload,
  onCancel,
  isLoading = false,
}: BaseDownloadMenuProps) {
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set(tables.map((t) => t.id))
  );
  const [downloadTypes, setDownloadTypes] = useState<
    Set<"tableIds" | "schema" | "data">
  >(new Set(["tableIds"]));
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgress | null>(null);

  // Reset progress when menu closes
  useEffect(() => {
    if (!isOpen) {
      setDownloadProgress(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTableToggle = (tableId: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const handleSelectAllTables = () => {
    if (selectedTables.size === tables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(tables.map((t) => t.id)));
    }
  };

  const handleDownloadTypeToggle = (type: "tableIds" | "schema" | "data") => {
    setDownloadTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleDownload = () => {
    if (selectedTables.size === 0 || downloadTypes.size === 0) {
      return;
    }
    setDownloadProgress({
      current: "Starting download...",
      total: 0,
      completed: 0,
      errors: [],
      files: [],
    });
    onDownload(
      {
        tableIds: Array.from(selectedTables),
        downloadTypes: Array.from(downloadTypes),
      },
      (progress) => {
        setDownloadProgress(progress);
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xl font-semibold text-[var(--text-main)]"
            style={{ fontFamily: "Outfit" }}
          >
            Download Base {baseId}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl"
            aria-label="Close"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[var(--text-main)]">
                Download Types
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-mid)]/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downloadTypes.has("tableIds")}
                  onChange={() => handleDownloadTypeToggle("tableIds")}
                  disabled={isLoading}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-[var(--text-main)]">
                    Table IDs
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Simple JSON with table IDs and names
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-mid)]/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downloadTypes.has("schema")}
                  onChange={() => handleDownloadTypeToggle("schema")}
                  disabled={isLoading}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-[var(--text-main)]">
                    Full Schema JSON
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Complete schema definitions for selected tables
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-mid)]/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downloadTypes.has("data")}
                  onChange={() => handleDownloadTypeToggle("data")}
                  disabled={isLoading}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-[var(--text-main)]">
                    Data CSV
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Export records as CSV files (one per table)
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[var(--text-main)]">
                Select Tables ({selectedTables.size} of {tables.length})
              </label>
              <button
                onClick={handleSelectAllTables}
                className="text-sm text-[var(--cta-blue)] hover:underline"
                disabled={isLoading}
              >
                {selectedTables.size === tables.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-[var(--border)] rounded-2xl p-3">
              {tables.map((table) => (
                <label
                  key={table.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-mid)]/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table.id)}
                    onChange={() => handleTableToggle(table.id)}
                    disabled={isLoading}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[var(--text-main)] truncate">
                      {table.name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {table.id} • {table.recordCount ?? 0} records
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {isLoading && onCancel ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
            >
              Cancel Download
            </button>
          ) : (
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={
              isLoading || selectedTables.size === 0 || downloadTypes.size === 0
            }
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Downloading..." : "Download"}
          </button>
        </div>

        {isLoading && downloadProgress && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-mid)]/30 p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-main)]">
                  {downloadProgress.current}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {downloadProgress.completed} of {downloadProgress.total}
                </span>
              </div>
              {downloadProgress.total > 0 && (
                <div className="w-full bg-[var(--bg-mid)] rounded-full h-2">
                  <div
                    className="bg-[var(--brand)] h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (downloadProgress.completed / downloadProgress.total) *
                        100
                      }%`,
                    }}
                  />
                </div>
              )}
            </div>

            {downloadProgress.files.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                  Files prepared:
                </div>
                {[...downloadProgress.files].reverse().map((file, idx) => {
                  // Check if this file is currently being processed
                  // Match by sanitizing both names and checking if file name contains table name
                  const sanitizeTableName = (name: string) =>
                    name.toLowerCase().replace(/[^a-z0-9]/gi, "_");
                  const sanitizedCurrentTable = downloadProgress.currentTable
                    ? sanitizeTableName(downloadProgress.currentTable)
                    : "";
                  const sanitizedFileName = sanitizeTableName(file.name);

                  const isProcessing =
                    downloadProgress.currentTable &&
                    sanitizedFileName.includes(sanitizedCurrentTable) &&
                    file.size === 0;
                  const isCompleted = file.size > 0 && !isProcessing;

                  return (
                    <div
                      key={idx}
                      className="text-xs text-[var(--text-main)] flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <span className="inline-block h-3 w-3 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
                      ) : isCompleted ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">○</span>
                      )}
                      <span>{file.name}</span>
                      {file.size > 0 && (
                        <span className="text-[var(--text-muted)]">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {downloadProgress.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-xs font-medium text-red-600 mb-1">
                  Errors:
                </div>
                {downloadProgress.errors.map((error, idx) => (
                  <div key={idx} className="text-xs text-red-600">
                    • {error}
                  </div>
                ))}
              </div>
            )}

            {downloadProgress.completed === downloadProgress.total &&
              downloadProgress.total > 0 && (
                <div className="mt-3 text-sm font-medium text-green-600">
                  ✓ Ready to download
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
