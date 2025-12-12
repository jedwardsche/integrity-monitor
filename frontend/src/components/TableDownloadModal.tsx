import React from "react";

interface TableDownloadModalProps {
  isOpen: boolean;
  tableName: string;
  tableId: string;
  onClose: () => void;
  onDownloadData: () => void;
  onDownloadSchema: () => void;
  isLoading?: boolean;
}

export function TableDownloadModal({
  isOpen,
  tableName,
  tableId,
  onClose,
  onDownloadData,
  onDownloadSchema,
  isLoading = false,
}: TableDownloadModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xl font-semibold text-[var(--text-main)]"
            style={{ fontFamily: "Outfit" }}
          >
            Download {tableName}
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

        <p className="text-sm text-[var(--text-muted)] mb-4">
          Choose what you want to download for this table:
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              onDownloadData();
              onClose();
            }}
            disabled={isLoading}
            className="w-full rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:bg-[var(--bg-mid)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium text-[var(--text-main)]">
              Download data as CSV
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Export all records from this table as a CSV file
            </div>
          </button>

          <button
            onClick={() => {
              onDownloadSchema();
              onClose();
            }}
            disabled={isLoading}
            className="w-full rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:bg-[var(--bg-mid)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium text-[var(--text-main)]">
              Download schema as JSON
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              Export table structure and field definitions as JSON
            </div>
          </button>
        </div>

        {isLoading && (
          <div className="mt-4 text-sm text-[var(--text-muted)] text-center">
            Preparing download...
          </div>
        )}
      </div>
    </div>
  );
}
