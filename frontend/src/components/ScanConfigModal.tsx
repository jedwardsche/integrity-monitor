import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useRules } from "../hooks/useRules";
import type { AirtableSchema, AirtableTable } from "../utils/airtable";

export interface ScanConfig {
  checks: {
    duplicates: boolean;
    links: boolean;
    required_fields: boolean;
    attendance: boolean;
  };
  entities?: string[]; // Optional: selected entity names to scan
  rules?: {
    duplicates?: Record<string, string[]>;
    relationships?: Record<string, string[]>;
    required_fields?: Record<string, string[]>;
    attendance_rules?: boolean;
  };
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
    new Set() // CRITICAL FIX: Start with NO entities selected - user must select manually
  );
  const [selectedRules, setSelectedRules] = useState<{
    duplicates?: Record<string, string[]>;
    relationships?: Record<string, string[]>;
    required_fields?: Record<string, string[]>;
    attendance_rules?: boolean;
  }>({});
  const [expandedCheckTypes, setExpandedCheckTypes] = useState<Set<string>>(
    new Set(["duplicates", "links", "required_fields", "attendance"])
  );
  const { getToken } = useAuth();
  const { loadRules } = useRules();
  const [rules, setRules] = useState<any>(null);

  // Reset state when modal closes to ensure clean slate on next open
  useEffect(() => {
    if (!isOpen) {
      // Clear all selections when modal closes
      setSelectedEntities(new Set());
      setSelectedRules({});
      setRules(null);
      setSchema(null);
    }
  }, [isOpen]);

  // Load rules when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadRulesData = async () => {
      try {
        const rulesData = await loadRules();
        setRules(rulesData);
      } catch (error) {
        console.error("Failed to load rules:", error);
      }
    };

    loadRulesData();
  }, [isOpen, loadRules]);

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

  // REMOVED: useEffect that auto-selected all entities when schema loaded
  // This was causing ALL tables to be auto-selected, leading to unintended scans
  // Users must now explicitly select tables and rules

  // Get all rule IDs for an entity in a category
  const getAllRuleIds = (
    category: "duplicates" | "relationships" | "required_fields",
    entityName: string
  ): string[] => {
    if (!rules) return [];
    const categoryRules = rules[category]?.[entityName];
    if (!categoryRules) return [];

    if (category === "duplicates") {
      const dupDef = categoryRules as { likely?: any[]; possible?: any[] };
      const likelyIds = (dupDef.likely || []).map((r: any) => r.rule_id);
      const possibleIds = (dupDef.possible || []).map((r: any) => r.rule_id);
      return [...likelyIds, ...possibleIds];
    } else if (category === "relationships") {
      return Object.keys(categoryRules);
    } else if (category === "required_fields") {
      return (categoryRules as any[]).map(
        (r: any) => r.rule_id || r.field || `required.${entityName}.${r.field}`
      );
    }
    return [];
  };

  // Check if all rules are selected for a check type across all entities
  const areAllRulesSelectedForCheckType = (
    checkType: "duplicates" | "links" | "required_fields" | "attendance"
  ): boolean => {
    if (checkType === "attendance") {
      return selectedRules.attendance_rules === true;
    }

    const category =
      checkType === "duplicates"
        ? "duplicates"
        : checkType === "links"
        ? "relationships"
        : "required_fields";

    if (selectedEntities.size === 0) return false;
    if (!rules) return false;

    // Check if all entities have all their rules selected
    const allSelected = Array.from(selectedEntities).every((entity) => {
      const allIds = getAllRuleIds(category, entity);
      if (allIds.length === 0) return true; // No rules means "all selected"
      const selectedIds = selectedRules[category]?.[entity] || [];
      return (
        selectedIds.length === allIds.length &&
        allIds.every((id) => selectedIds.includes(id))
      );
    });

    return allSelected;
  };

  // Check if any rules are selected for a check type (for indeterminate state)
  const areAnyRulesSelectedForCheckType = (
    checkType: "duplicates" | "links" | "required_fields" | "attendance"
  ): boolean => {
    if (checkType === "attendance") {
      return selectedRules.attendance_rules === true;
    }

    const category =
      checkType === "duplicates"
        ? "duplicates"
        : checkType === "links"
        ? "relationships"
        : "required_fields";

    if (selectedEntities.size === 0) return false;
    if (!rules) return false;

    // Check if any entity has any rules selected
    return Array.from(selectedEntities).some((entity) => {
      const selectedIds = selectedRules[category]?.[entity] || [];
      return selectedIds.length > 0;
    });
  };

  // Sync check type state with rule selection state
  useEffect(() => {
    if (!rules) return;

    setChecks((prev) => {
      const next = { ...prev };
      // Only update if we have entities selected, otherwise keep current state
      if (selectedEntities.size > 0) {
        next.duplicates = areAllRulesSelectedForCheckType("duplicates");
        next.links = areAllRulesSelectedForCheckType("links");
        next.required_fields =
          areAllRulesSelectedForCheckType("required_fields");
      }
      next.attendance = areAllRulesSelectedForCheckType("attendance");
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRules, selectedEntities.size, rules]);

  if (!isOpen) return null;

  const toggleCheckType = (checkName: keyof typeof checks) => {
    const allSelected = areAllRulesSelectedForCheckType(checkName);
    const newValue = !allSelected;

    // When toggling a check type, select/deselect all its rules
    if (newValue) {
      // Select all rules for this check type
      if (checkName === "duplicates") {
        selectedEntities.forEach((entity) => {
          const ruleIds = getAllRuleIds("duplicates", entity);
          if (ruleIds.length > 0) {
            handleRulesChange("duplicates", entity, ruleIds);
          }
        });
      } else if (checkName === "links") {
        selectedEntities.forEach((entity) => {
          const ruleIds = getAllRuleIds("relationships", entity);
          if (ruleIds.length > 0) {
            handleRulesChange("relationships", entity, ruleIds);
          }
        });
      } else if (checkName === "required_fields") {
        selectedEntities.forEach((entity) => {
          const ruleIds = getAllRuleIds("required_fields", entity);
          if (ruleIds.length > 0) {
            handleRulesChange("required_fields", entity, ruleIds);
          }
        });
      } else if (checkName === "attendance") {
        handleRulesChange("attendance_rules", "", true);
      }
      // Update check state to enabled
      setChecks((prev) => ({
        ...prev,
        [checkName]: true,
      }));
    } else {
      // Deselect all rules for this check type
      if (checkName === "duplicates") {
        selectedEntities.forEach((entity) => {
          handleRulesChange("duplicates", entity, []);
        });
      } else if (checkName === "links") {
        selectedEntities.forEach((entity) => {
          handleRulesChange("relationships", entity, []);
        });
      } else if (checkName === "required_fields") {
        selectedEntities.forEach((entity) => {
          handleRulesChange("required_fields", entity, []);
        });
      } else if (checkName === "attendance") {
        handleRulesChange("attendance_rules", "", false);
      }
      // Update check state to disabled
      setChecks((prev) => ({
        ...prev,
        [checkName]: false,
      }));
    }
  };

  const toggleCheckTypeExpansion = (checkType: string) => {
    setExpandedCheckTypes((prev) => {
      const next = new Set(prev);
      if (next.has(checkType)) {
        next.delete(checkType);
      } else {
        next.add(checkType);
      }
      return next;
    });
  };

  // Initialize rules for an entity (DO NOT auto-select - user must select manually)
  const initializeRulesForEntity = (entity: string) => {
    // CRITICAL FIX: Do NOT automatically select all rules when an entity is selected
    // The user must explicitly check the individual rules they want to run
    // Previously this was auto-selecting ALL rules, causing scans to run unselected rules

    // Just ensure the entity exists in selectedRules with empty arrays
    setSelectedRules((prev) => {
      const next = { ...prev };

      // Initialize with empty arrays so the UI works, but don't pre-select anything
      if (!next.duplicates) {
        next.duplicates = {};
      }
      if (!next.duplicates[entity]) {
        next.duplicates[entity] = [];
      }

      if (!next.relationships) {
        next.relationships = {};
      }
      if (!next.relationships[entity]) {
        next.relationships[entity] = [];
      }

      if (!next.required_fields) {
        next.required_fields = {};
      }
      if (!next.required_fields[entity]) {
        next.required_fields[entity] = [];
      }

      return next;
    });
  };

  // Remove rules for an entity
  const removeRulesForEntity = (entity: string) => {
    setSelectedRules((prev) => {
      const next = { ...prev };
      if (next.duplicates) {
        delete next.duplicates[entity];
      }
      if (next.relationships) {
        delete next.relationships[entity];
      }
      if (next.required_fields) {
        delete next.required_fields[entity];
      }
      return next;
    });
  };

  const handleEntityToggle = (entity: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) {
        next.delete(entity);
        removeRulesForEntity(entity);
      } else {
        next.add(entity);
        initializeRulesForEntity(entity);
      }
      return next;
    });
  };

  const handleRulesChange = (
    category:
      | "duplicates"
      | "relationships"
      | "required_fields"
      | "attendance_rules",
    entity: string,
    ruleIds: string[] | boolean
  ) => {
    setSelectedRules((prev) => {
      const next = { ...prev };
      if (category === "attendance_rules") {
        next.attendance_rules = ruleIds as boolean;
      } else {
        if (!next[category]) {
          next[category] = {};
        }
        next[category]![entity] = ruleIds as string[];
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

  const handleSelectAllCheckTypes = () => {
    const allSelected =
      areAllRulesSelectedForCheckType("duplicates") &&
      areAllRulesSelectedForCheckType("links") &&
      areAllRulesSelectedForCheckType("required_fields") &&
      areAllRulesSelectedForCheckType("attendance");

    if (allSelected) {
      // Deselect all
      toggleCheckType("duplicates");
      toggleCheckType("links");
      toggleCheckType("required_fields");
      toggleCheckType("attendance");
    } else {
      // Select all
      if (!areAllRulesSelectedForCheckType("duplicates")) {
        toggleCheckType("duplicates");
      }
      if (!areAllRulesSelectedForCheckType("links")) {
        toggleCheckType("links");
      }
      if (!areAllRulesSelectedForCheckType("required_fields")) {
        toggleCheckType("required_fields");
      }
      if (!areAllRulesSelectedForCheckType("attendance")) {
        toggleCheckType("attendance");
      }
    }
  };

  const handleConfirm = () => {
    // CRITICAL FIX: Determine what runs based ONLY on selectedRules, not the checks state
    // This ensures scans only run the rules the user explicitly selected

    // Check if we have any duplicate rules selected (any entity with rules)
    const hasDuplicateRules = Boolean(
      selectedRules.duplicates &&
        Object.values(selectedRules.duplicates).some(
          (ruleIds) => ruleIds.length > 0
        )
    );

    // Check if we have any relationship rules selected
    const hasRelationshipRules = Boolean(
      selectedRules.relationships &&
        Object.values(selectedRules.relationships).some(
          (ruleIds) => ruleIds.length > 0
        )
    );

    // Check if we have any required field rules selected
    const hasRequiredFieldRules = Boolean(
      selectedRules.required_fields &&
        Object.values(selectedRules.required_fields).some(
          (ruleIds) => ruleIds.length > 0
        )
    );

    // Check if attendance rules are selected
    const hasAttendanceRules = selectedRules.attendance_rules === true;

    // Build effectiveChecks based ONLY on what rules are actually selected
    const effectiveChecks = {
      duplicates: hasDuplicateRules,
      links: hasRelationshipRules,
      required_fields: hasRequiredFieldRules,
      attendance: hasAttendanceRules,
    };

    // Only include rules if at least one category has selections
    const hasRules =
      hasDuplicateRules ||
      hasRelationshipRules ||
      hasRequiredFieldRules ||
      hasAttendanceRules;

    onConfirm({
      checks: effectiveChecks,
      entities:
        selectedEntities.size > 0 ? Array.from(selectedEntities) : undefined,
      rules: hasRules ? selectedRules : undefined,
    });
  };

  // Check if at least one rule is selected (not all rules, just at least one)
  const hasAtLeastOneCheck = (() => {
    if (selectedRules.attendance_rules === true) return true;

    // Check if any entity has any rules selected for any category
    if (selectedRules.duplicates) {
      for (const entity in selectedRules.duplicates) {
        if (selectedRules.duplicates[entity].length > 0) return true;
      }
    }
    if (selectedRules.relationships) {
      for (const entity in selectedRules.relationships) {
        if (selectedRules.relationships[entity].length > 0) return true;
      }
    }
    if (selectedRules.required_fields) {
      for (const entity in selectedRules.required_fields) {
        if (selectedRules.required_fields[entity].length > 0) return true;
      }
    }
    return false;
  })();
  const hasAtLeastOneEntity = selectedEntities.size > 0;

  // Count total number of selected rules
  const totalRuleCount = (() => {
    let count = 0;

    // Count attendance rules (1 if enabled, 0 if not)
    if (selectedRules.attendance_rules === true) {
      count += 1;
    }

    // Count duplicate rules
    if (selectedRules.duplicates) {
      for (const entity in selectedRules.duplicates) {
        count += selectedRules.duplicates[entity].length;
      }
    }

    // Count relationship rules
    if (selectedRules.relationships) {
      for (const entity in selectedRules.relationships) {
        count += selectedRules.relationships[entity].length;
      }
    }

    // Count required field rules
    if (selectedRules.required_fields) {
      for (const entity in selectedRules.required_fields) {
        count += selectedRules.required_fields[entity].length;
      }
    }

    return count;
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative bg-white border border-[var(--border)] rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto transform transition-all p-6">
        <h3
          className="text-xl font-semibold text-[var(--text-main)] mb-4"
          style={{ fontFamily: "Outfit" }}
        >
          Configure Scan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Table/Entity Selection */}
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
                <div className="max-h-[600px] overflow-y-auto space-y-2 border border-[var(--border)] rounded-lg p-3">
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

          {/* Right Column - Check Types with Nested Rules */}
          <div className="space-y-6">
            {/* Check Types with Nested Rules */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Check Types & Rules
                </label>
                {selectedEntities.size > 0 && rules && (
                  <button
                    onClick={handleSelectAllCheckTypes}
                    className="text-sm text-[var(--brand)] hover:underline"
                    type="button"
                  >
                    {areAllRulesSelectedForCheckType("duplicates") &&
                    areAllRulesSelectedForCheckType("links") &&
                    areAllRulesSelectedForCheckType("required_fields") &&
                    areAllRulesSelectedForCheckType("attendance")
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {/* Duplicates Check Type */}
                <div className="border border-[var(--border)] rounded-lg">
                  <div className="flex items-center p-3 hover:bg-[var(--bg-mid)]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={areAllRulesSelectedForCheckType("duplicates")}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            areAnyRulesSelectedForCheckType("duplicates") &&
                            !areAllRulesSelectedForCheckType("duplicates");
                        }
                      }}
                      onChange={() => toggleCheckType("duplicates")}
                      className="mr-3 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-main)]">
                        Duplicates
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        Detect duplicate records across entities
                      </div>
                    </div>
                    {selectedEntities.size > 0 && rules && (
                      <button
                        type="button"
                        onClick={() => toggleCheckTypeExpansion("duplicates")}
                        className="ml-2 px-2 py-1 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-mid)]/30 rounded transition-colors"
                        aria-label={
                          expandedCheckTypes.has("duplicates")
                            ? "Collapse rules"
                            : "Expand rules"
                        }
                      >
                        {expandedCheckTypes.has("duplicates") ? "▼" : "▶"}
                      </button>
                    )}
                  </div>
                  {expandedCheckTypes.has("duplicates") &&
                    selectedEntities.size > 0 &&
                    rules && (
                      <div className="px-3 pb-3 pt-2 space-y-3 border-t border-[var(--border)] bg-[var(--bg-mid)]/20">
                        {Array.from(selectedEntities).map((entity) => {
                          const dupDef = rules.duplicates?.[entity] as
                            | { likely?: any[]; possible?: any[] }
                            | undefined;
                          if (!dupDef) return null;

                          const likelyRules = dupDef.likely || [];
                          const possibleRules = dupDef.possible || [];
                          const allRuleIds = getAllRuleIds(
                            "duplicates",
                            entity
                          );
                          const selectedIds =
                            selectedRules.duplicates?.[entity] || [];

                          if (allRuleIds.length === 0) return null;

                          return (
                            <div
                              key={entity}
                              className="ml-2 space-y-2 border-l-2 border-[var(--border)]/50 pl-3"
                            >
                              <div className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wide">
                                {ENTITY_TABLE_MAPPING[entity] || entity}
                              </div>
                              {likelyRules.length > 0 && (
                                <div className="ml-1 space-y-1">
                                  <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5">
                                    Likely
                                  </div>
                                  {likelyRules.map((rule: any) => (
                                    <label
                                      key={rule.rule_id}
                                      className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-mid)]/40 cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(
                                          rule.rule_id
                                        )}
                                        onChange={() =>
                                          handleRulesChange(
                                            "duplicates",
                                            entity,
                                            selectedIds.includes(rule.rule_id)
                                              ? selectedIds.filter(
                                                  (id) => id !== rule.rule_id
                                                )
                                              : [...selectedIds, rule.rule_id]
                                          )
                                        }
                                        className="w-3.5 h-3.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-[var(--text-main)]">
                                          {rule.rule_id}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] truncate">
                                          {rule.description || ""}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {possibleRules.length > 0 && (
                                <div className="ml-1 mt-3 space-y-1">
                                  <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5">
                                    Possible
                                  </div>
                                  {possibleRules.map((rule: any) => (
                                    <label
                                      key={rule.rule_id}
                                      className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-mid)]/40 cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(
                                          rule.rule_id
                                        )}
                                        onChange={() =>
                                          handleRulesChange(
                                            "duplicates",
                                            entity,
                                            selectedIds.includes(rule.rule_id)
                                              ? selectedIds.filter(
                                                  (id) => id !== rule.rule_id
                                                )
                                              : [...selectedIds, rule.rule_id]
                                          )
                                        }
                                        className="w-3.5 h-3.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-[var(--text-main)]">
                                          {rule.rule_id}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] truncate">
                                          {rule.description || ""}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>

                {/* Missing Links Check Type */}
                <div className="border border-[var(--border)] rounded-lg">
                  <div className="flex items-center p-3 hover:bg-[var(--bg-mid)]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={areAllRulesSelectedForCheckType("links")}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            areAnyRulesSelectedForCheckType("links") &&
                            !areAllRulesSelectedForCheckType("links");
                        }
                      }}
                      onChange={() => toggleCheckType("links")}
                      className="mr-3 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-main)]">
                        Missing Links
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        Verify required relationships between records
                      </div>
                    </div>
                    {selectedEntities.size > 0 && rules && (
                      <button
                        type="button"
                        onClick={() => toggleCheckTypeExpansion("links")}
                        className="ml-2 px-2 py-1 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-mid)]/30 rounded transition-colors"
                        aria-label={
                          expandedCheckTypes.has("links")
                            ? "Collapse rules"
                            : "Expand rules"
                        }
                      >
                        {expandedCheckTypes.has("links") ? "▼" : "▶"}
                      </button>
                    )}
                  </div>
                  {expandedCheckTypes.has("links") &&
                    selectedEntities.size > 0 &&
                    rules && (
                      <div className="px-3 pb-3 pt-2 space-y-3 border-t border-[var(--border)] bg-[var(--bg-mid)]/20">
                        {Array.from(selectedEntities).map((entity) => {
                          const relRules = rules.relationships?.[entity];
                          if (!relRules || Object.keys(relRules).length === 0)
                            return null;

                          const selectedIds =
                            selectedRules.relationships?.[entity] || [];

                          return (
                            <div
                              key={entity}
                              className="ml-2 space-y-2 border-l-2 border-[var(--border)]/50 pl-3"
                            >
                              <div className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wide">
                                {ENTITY_TABLE_MAPPING[entity] || entity}
                              </div>
                              {Object.entries(relRules).map(
                                ([relKey, relRule]: [string, any]) => (
                                  <label
                                    key={relKey}
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-mid)]/40 cursor-pointer transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(relKey)}
                                      onChange={() =>
                                        handleRulesChange(
                                          "relationships",
                                          entity,
                                          selectedIds.includes(relKey)
                                            ? selectedIds.filter(
                                                (id) => id !== relKey
                                              )
                                            : [...selectedIds, relKey]
                                        )
                                      }
                                      className="w-3.5 h-3.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-[var(--text-main)]">
                                        {relKey}
                                      </div>
                                      <div className="text-xs text-[var(--text-muted)] truncate">
                                        {relRule.message || ""}
                                      </div>
                                    </div>
                                  </label>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>

                {/* Missing Fields Check Type */}
                <div className="border border-[var(--border)] rounded-lg">
                  <div className="flex items-center p-3 hover:bg-[var(--bg-mid)]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={areAllRulesSelectedForCheckType(
                        "required_fields"
                      )}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            areAnyRulesSelectedForCheckType(
                              "required_fields"
                            ) &&
                            !areAllRulesSelectedForCheckType("required_fields");
                        }
                      }}
                      onChange={() => toggleCheckType("required_fields")}
                      className="mr-3 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-main)]">
                        Missing Fields
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        Check for required field values
                      </div>
                    </div>
                    {selectedEntities.size > 0 && rules && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleCheckTypeExpansion("required_fields")
                        }
                        className="ml-2 px-2 py-1 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-mid)]/30 rounded transition-colors"
                        aria-label={
                          expandedCheckTypes.has("required_fields")
                            ? "Collapse rules"
                            : "Expand rules"
                        }
                      >
                        {expandedCheckTypes.has("required_fields") ? "▼" : "▶"}
                      </button>
                    )}
                  </div>
                  {expandedCheckTypes.has("required_fields") &&
                    selectedEntities.size > 0 &&
                    rules && (
                      <div className="px-3 pb-3 pt-2 space-y-3 border-t border-[var(--border)] bg-[var(--bg-mid)]/20">
                        {Array.from(selectedEntities).map((entity) => {
                          const reqFields = rules.required_fields?.[entity];
                          if (
                            !reqFields ||
                            !Array.isArray(reqFields) ||
                            reqFields.length === 0
                          )
                            return null;

                          const selectedIds =
                            selectedRules.required_fields?.[entity] || [];

                          return (
                            <div
                              key={entity}
                              className="ml-2 space-y-2 border-l-2 border-[var(--border)]/50 pl-3"
                            >
                              <div className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wide">
                                {ENTITY_TABLE_MAPPING[entity] || entity}
                              </div>
                              {reqFields.map((field: any) => {
                                const ruleId =
                                  field.rule_id ||
                                  field.field ||
                                  `required.${entity}.${field.field}`;
                                return (
                                  <label
                                    key={ruleId}
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-mid)]/40 cursor-pointer transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(ruleId)}
                                      onChange={() =>
                                        handleRulesChange(
                                          "required_fields",
                                          entity,
                                          selectedIds.includes(ruleId)
                                            ? selectedIds.filter(
                                                (id) => id !== ruleId
                                              )
                                            : [...selectedIds, ruleId]
                                        )
                                      }
                                      className="w-3.5 h-3.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-[var(--text-main)]">
                                        {field.field || ruleId}
                                      </div>
                                      <div className="text-xs text-[var(--text-muted)] truncate">
                                        {field.message || ""}
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>

                {/* Attendance Anomalies Check Type */}
                <div className="border border-[var(--border)] rounded-lg">
                  <div className="flex items-center p-3 hover:bg-[var(--bg-mid)]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={areAllRulesSelectedForCheckType("attendance")}
                      onChange={() => toggleCheckType("attendance")}
                      className="mr-3 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[var(--text-main)]">
                        Attendance Anomalies
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        Detect attendance pattern issues
                      </div>
                    </div>
                    {rules?.attendance_rules && (
                      <button
                        type="button"
                        onClick={() => toggleCheckTypeExpansion("attendance")}
                        className="ml-2 px-2 py-1 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-mid)]/30 rounded transition-colors"
                        aria-label={
                          expandedCheckTypes.has("attendance")
                            ? "Collapse rules"
                            : "Expand rules"
                        }
                      >
                        {expandedCheckTypes.has("attendance") ? "▼" : "▶"}
                      </button>
                    )}
                  </div>
                  {expandedCheckTypes.has("attendance") &&
                    rules?.attendance_rules && (
                      <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] bg-[var(--bg-mid)]/20">
                        <label className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-mid)]/40 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedRules.attendance_rules ?? true}
                            onChange={(e) =>
                              handleRulesChange(
                                "attendance_rules",
                                "",
                                e.target.checked
                              )
                            }
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-sm font-medium text-[var(--text-main)]">
                            Attendance Rules
                          </span>
                        </label>
                      </div>
                    )}
                </div>
              </div>
              {!hasAtLeastOneCheck && (
                <p className="mt-2 text-sm text-red-600">
                  Please select at least one check type
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rule Count */}
        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <div className="text-sm text-[var(--text-muted)] text-center">
            {totalRuleCount === 0 ? (
              "No rules selected"
            ) : (
              <>
                <span className="font-medium text-[var(--text-main)]">
                  {totalRuleCount}
                </span>{" "}
                {totalRuleCount === 1 ? "rule" : "rules"} will be used for this
                scan
              </>
            )}
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
