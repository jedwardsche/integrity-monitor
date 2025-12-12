import React, { useState } from "react";

export interface ScanConfig {
  mode: "incremental" | "full";
  checks: {
    duplicates: boolean;
    links: boolean;
    required_fields: boolean;
    attendance: boolean;
  };
}

interface ScanConfigModalProps {
  isOpen: boolean;
  onConfirm: (config: ScanConfig) => void;
  onCancel: () => void;
}

export function ScanConfigModal({
  isOpen,
  onConfirm,
  onCancel,
}: ScanConfigModalProps) {
  const [mode, setMode] = useState<"incremental" | "full">("incremental");
  const [checks, setChecks] = useState({
    duplicates: true,
    links: true,
    required_fields: true,
    attendance: true,
  });

  if (!isOpen) return null;

  const handleCheckChange = (checkName: keyof typeof checks) => {
    setChecks((prev) => ({
      ...prev,
      [checkName]: !prev[checkName],
    }));
  };

  const handleConfirm = () => {
    onConfirm({ mode, checks });
  };

  const hasAtLeastOneCheck = Object.values(checks).some((v) => v);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative bg-white border border-[var(--border)] rounded-xl shadow-xl w-full max-w-lg transform transition-all p-6">
        <h3
          className="text-xl font-semibold text-[var(--text-main)] mb-4"
          style={{ fontFamily: "Outfit" }}
        >
          Configure Scan
        </h3>

        {/* Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-main)] mb-3">
            Scan Mode
          </label>
          <div className="space-y-2">
            <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
              <input
                type="radio"
                name="mode"
                value="incremental"
                checked={mode === "incremental"}
                onChange={(e) =>
                  setMode(e.target.value as "incremental" | "full")
                }
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-main)]">
                  Incremental Scan
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Only scan records modified since the last successful run
                </div>
              </div>
            </label>
            <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
              <input
                type="radio"
                name="mode"
                value="full"
                checked={mode === "full"}
                onChange={(e) =>
                  setMode(e.target.value as "incremental" | "full")
                }
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-main)]">
                  Full Scan
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Scan all records regardless of modification time
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Check Types Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--text-main)] mb-3">
            Check Types
          </label>
          <div className="space-y-2">
            <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
              <input
                type="checkbox"
                checked={checks.duplicates}
                onChange={() => handleCheckChange("duplicates")}
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-main)]">
                  Duplicates
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Detect duplicate records across entities
                </div>
              </div>
            </label>
            <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
              <input
                type="checkbox"
                checked={checks.links}
                onChange={() => handleCheckChange("links")}
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-main)]">
                  Missing Links
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Verify required relationships between records
                </div>
              </div>
            </label>
            <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
              <input
                type="checkbox"
                checked={checks.required_fields}
                onChange={() => handleCheckChange("required_fields")}
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-main)]">
                  Missing Fields
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Check for required field values
                </div>
              </div>
            </label>
            <label className="flex items-center p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-mid)] transition-colors">
              <input
                type="checkbox"
                checked={checks.attendance}
                onChange={() => handleCheckChange("attendance")}
                className="mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-main)]">
                  Attendance Anomalies
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Detect attendance pattern issues
                </div>
              </div>
            </label>
          </div>
          {!hasAtLeastOneCheck && (
            <p className="mt-2 text-sm text-red-600">
              Please select at least one check type
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-mid)]/50 hover:bg-[var(--bg-mid)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasAtLeastOneCheck}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm bg-[var(--brand)] hover:bg-[var(--brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run Scan
          </button>
        </div>
      </div>
    </div>
  );
}
