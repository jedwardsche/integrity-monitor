import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import type { AirtableSchema, AirtableTable } from "../utils/airtable";

export interface ScanConfig {
  checks: {
    duplicates: boolean;
    links: boolean;
    required_fields: boolean;
    attendance: boolean;
  };
  entities?: string[]; // Optional: selected entity names to scan
}

interface ScanConfigModalProps {
  isOpen: boolean;
  onConfirm: (config: ScanConfig) => void;
  onCancel: () => void;
}

// Entity to table name mapping (from backend table_mapping.yaml)
const ENTITY_TABLE_MAPPING: Record<string, string> = {
  students: "Students",
  parents: "Parents",
  contractors: "Contractors/Volunteers",
  classes: "Classes",
  attendance: "Attendance",
  truth: "Truth",
  payments: "Contractor/Vendor Invoices",
  data_issues: "Help Tickets",
};

// Reverse mapping: table name to entity
const TABLE_ENTITY_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(ENTITY_TABLE_MAPPING).map(([entity, table]) => [table, entity])
);

import { API_BASE } from "../config/api";

export function ScanConfigModal({
  isOpen,
  onConfirm,
  onCancel,
}: ScanConfigModalProps) {
  const [checks, setChecks] = useState({
    duplicates: true,
    links: true,
    required_fields: true,
    attendance: true,
  });
  const [schema, setSchema] = useState<AirtableSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(
    new Set(Object.keys(ENTITY_TABLE_MAPPING))
  );
  const { getToken } = useAuth();

  // Fetch schema when modal opens - load from local JSON first for instant display
  useEffect(() => {
    if (!isOpen) return;

    const loadSchema = async () => {
      setSchemaLoading(true);
      try {
        // Try local schema first (instant, no network request)
        const localResponse = await fetch("/airtable-schema.json", {
          cache: "no-store",
        });
        if (localResponse.ok) {
          const localData = await localResponse.json();
          setSchema(localData);
          setSchemaLoading(false);
          // Optionally refresh from API in background (non-blocking)
          try {
            const token = await getToken();
            const apiResponse = await fetch(`${API_BASE}/airtable/schema`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (apiResponse.ok) {
              const apiData = await apiResponse.json();
              setSchema(apiData); // Update with fresh data if available
            }
          } catch (apiError) {
            // Silently fail - we already have local schema
            console.debug("Failed to refresh schema from API:", apiError);
          }
        } else {
          // Fallback to API if local schema not available
          const token = await getToken();
          const response = await fetch(`${API_BASE}/airtable/schema`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (response.ok) {
            const data = await response.json();
            setSchema(data);
          }
          setSchemaLoading(false);
        }
      } catch (error) {
        console.error("Failed to load schema:", error);
        setSchemaLoading(false);
      }
    };

    loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Map tables to entities
  const entityTableMap = React.useMemo(() => {
    if (!schema) return new Map<string, AirtableTable>();

    const map = new Map<string, AirtableTable>();
    for (const table of schema.tables || []) {
      const entity = TABLE_ENTITY_MAPPING[table.name];
      if (entity) {
        map.set(entity, table);
      }
    }
    return map;
  }, [schema]);

  // Get available entities (those that have tables in schema)
  const availableEntities = React.useMemo(() => {
    return Array.from(entityTableMap.keys()).sort();
  }, [entityTableMap]);

  // Initialize selected entities when schema loads
  useEffect(() => {
    if (
      availableEntities.length > 0 &&
      selectedEntities.size === Object.keys(ENTITY_TABLE_MAPPING).length
    ) {
      // Only auto-select all if we had all entities selected before
      setSelectedEntities(new Set(availableEntities));
    }
  }, [availableEntities]);

  if (!isOpen) return null;

  const handleCheckChange = (checkName: keyof typeof checks) => {
    setChecks((prev) => ({
      ...prev,
      [checkName]: !prev[checkName],
    }));
  };

  const handleEntityToggle = (entity: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) {
        next.delete(entity);
      } else {
        next.add(entity);
      }
      return next;
    });
  };

  const handleSelectAllEntities = () => {
    if (selectedEntities.size === availableEntities.length) {
      setSelectedEntities(new Set());
    } else {
      setSelectedEntities(new Set(availableEntities));
    }
  };

  const handleConfirm = () => {
    onConfirm({
      checks,
      entities:
        selectedEntities.size > 0 ? Array.from(selectedEntities) : undefined,
    });
  };

  const hasAtLeastOneCheck = Object.values(checks).some((v) => v);
  const hasAtLeastOneEntity = selectedEntities.size > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative bg-white border border-[var(--border)] rounded-xl shadow-xl w-full max-w-4xl transform transition-all p-6">
        <h3
          className="text-xl font-semibold text-[var(--text-main)] mb-4"
          style={{ fontFamily: "Outfit" }}
        >
          Configure Scan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Check Types Selection */}
            <div>
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
          </div>

          {/* Right Column */}
          <div>
            {/* Table/Entity Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Select Tables ({selectedEntities.size} of{" "}
                  {availableEntities.length})
                </label>
                {availableEntities.length > 0 && (
                  <button
                    onClick={handleSelectAllEntities}
                    className="text-sm text-[var(--brand)] hover:underline"
                    type="button"
                  >
                    {selectedEntities.size === availableEntities.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                )}
              </div>
              {schemaLoading ? (
                <div className="text-sm text-[var(--text-muted)] py-4 text-center">
                  Loading tables...
                </div>
              ) : availableEntities.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] py-4 text-center">
                  No tables found. Please check your schema configuration.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 border border-[var(--border)] rounded-lg p-3">
                  {availableEntities.map((entity) => {
                    const table = entityTableMap.get(entity);
                    return (
                      <label
                        key={entity}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-mid)]/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEntities.has(entity)}
                          onChange={() => handleEntityToggle(entity)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-[var(--text-main)]">
                            {ENTITY_TABLE_MAPPING[entity] || entity}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {entity} • {table?.recordCount ?? 0} records •{" "}
                            {table?.fieldCount ?? 0} fields
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {!hasAtLeastOneEntity && (
                <p className="mt-2 text-sm text-red-600">
                  Please select at least one table
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-mid)]/50 hover:bg-[var(--bg-mid)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!hasAtLeastOneCheck || !hasAtLeastOneEntity}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm bg-[var(--brand)] hover:bg-[var(--brand)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run Scan
          </button>
        </div>
      </div>
    </div>
  );
}
