import { useState, useEffect } from "react";

interface RuleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ruleData: Record<string, any>) => void;
  category: string;
  entity?: string;
  initialRule?: Record<string, any>;
  mode: "create" | "edit";
}

export function RuleEditor({
  isOpen,
  onClose,
  onSave,
  category,
  entity,
  initialRule,
  mode,
}: RuleEditorProps) {
  const [ruleData, setRuleData] = useState<Record<string, any>>(
    initialRule || {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialRule) {
      setRuleData(initialRule);
    } else {
      setRuleData({});
    }
    setErrors({});
  }, [initialRule, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (category === "duplicates") {
      if (!ruleData.description)
        newErrors.description = "Description is required";
      if (!ruleData.rule_id) newErrors.rule_id = "Rule ID is required";
      if (!ruleData.conditions || ruleData.conditions.length === 0) {
        newErrors.conditions = "At least one condition is required";
      }
    } else if (category === "relationships") {
      if (!ruleData.target) newErrors.target = "Target entity is required";
      if (!ruleData.message) newErrors.message = "Message is required";
    } else if (category === "required_fields") {
      if (!ruleData.field) newErrors.field = "Field name is required";
      if (!ruleData.message) newErrors.message = "Message is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(ruleData);
      handleClose();
    }
  };

  const handleClose = () => {
    setRuleData({});
    setErrors({});
    onClose();
  };

  const updateField = (field: string, value: any) => {
    setRuleData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const renderDuplicateFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Rule ID *
        </label>
        <input
          type="text"
          value={ruleData.rule_id || ""}
          onChange={(e) => updateField("rule_id", e.target.value)}
          className={`w-full p-2 border rounded-lg ${
            errors.rule_id ? "border-red-500" : "border-[var(--border)]"
          }`}
        />
        {errors.rule_id && (
          <p className="text-red-500 text-xs mt-1">{errors.rule_id}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Description *
        </label>
        <textarea
          value={ruleData.description || ""}
          onChange={(e) => updateField("description", e.target.value)}
          className={`w-full p-2 border rounded-lg ${
            errors.description ? "border-red-500" : "border-[var(--border)]"
          }`}
          rows={3}
        />
        {errors.description && (
          <p className="text-red-500 text-xs mt-1">{errors.description}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Severity
        </label>
        <select
          value={ruleData.severity || "warning"}
          onChange={(e) => updateField("severity", e.target.value)}
          className="w-full p-2 border border-[var(--border)] rounded-lg"
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Conditions (JSON)
        </label>
        <textarea
          value={JSON.stringify(ruleData.conditions || [], null, 2)}
          onChange={(e) => {
            try {
              updateField("conditions", JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, keep as is
            }
          }}
          className={`w-full p-2 border rounded-lg font-mono text-sm ${
            errors.conditions ? "border-red-500" : "border-[var(--border)]"
          }`}
          rows={6}
        />
        {errors.conditions && (
          <p className="text-red-500 text-xs mt-1">{errors.conditions}</p>
        )}
      </div>
    </>
  );

  const renderRelationshipFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Target Entity *
        </label>
        <input
          type="text"
          value={ruleData.target || ""}
          onChange={(e) => updateField("target", e.target.value)}
          className={`w-full p-2 border rounded-lg ${
            errors.target ? "border-red-500" : "border-[var(--border)]"
          }`}
        />
        {errors.target && (
          <p className="text-red-500 text-xs mt-1">{errors.target}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Message *
        </label>
        <textarea
          value={ruleData.message || ""}
          onChange={(e) => updateField("message", e.target.value)}
          className={`w-full p-2 border rounded-lg ${
            errors.message ? "border-red-500" : "border-[var(--border)]"
          }`}
          rows={2}
        />
        {errors.message && (
          <p className="text-red-500 text-xs mt-1">{errors.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
            Min Links
          </label>
          <input
            type="number"
            value={ruleData.min_links || 0}
            onChange={(e) =>
              updateField("min_links", parseInt(e.target.value) || 0)
            }
            className="w-full p-2 border border-[var(--border)] rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
            Max Links
          </label>
          <input
            type="number"
            value={ruleData.max_links || ""}
            onChange={(e) =>
              updateField(
                "max_links",
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            className="w-full p-2 border border-[var(--border)] rounded-lg"
            placeholder="Optional"
          />
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ruleData.require_active || false}
            onChange={(e) => updateField("require_active", e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-[var(--text-main)]">
            Require Active
          </span>
        </label>
      </div>
    </>
  );

  const renderRequiredFieldFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Field Name *
        </label>
        <input
          type="text"
          value={ruleData.field || ""}
          onChange={(e) => updateField("field", e.target.value)}
          className={`w-full p-2 border rounded-lg ${
            errors.field ? "border-red-500" : "border-[var(--border)]"
          }`}
        />
        {errors.field && (
          <p className="text-red-500 text-xs mt-1">{errors.field}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Message *
        </label>
        <textarea
          value={ruleData.message || ""}
          onChange={(e) => updateField("message", e.target.value)}
          className={`w-full p-2 border rounded-lg ${
            errors.message ? "border-red-500" : "border-[var(--border)]"
          }`}
          rows={2}
        />
        {errors.message && (
          <p className="text-red-500 text-xs mt-1">{errors.message}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
          Severity
        </label>
        <select
          value={ruleData.severity || "warning"}
          onChange={(e) => updateField("severity", e.target.value)}
          className="w-full p-2 border border-[var(--border)] rounded-lg"
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>
    </>
  );

  const renderAttendanceFields = () => (
    <div>
      <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
        Thresholds (JSON)
      </label>
      <textarea
        value={JSON.stringify(ruleData.thresholds || {}, null, 2)}
        onChange={(e) => {
          try {
            updateField("thresholds", JSON.parse(e.target.value));
          } catch {
            // Invalid JSON
          }
        }}
        className="w-full p-2 border border-[var(--border)] rounded-lg font-mono text-sm"
        rows={8}
      />
    </div>
  );

  const renderFields = () => {
    switch (category) {
      case "duplicates":
        return renderDuplicateFields();
      case "relationships":
        return renderRelationshipFields();
      case "required_fields":
        return renderRequiredFieldFields();
      case "attendance_rules":
        return renderAttendanceFields();
      default:
        return <div>Unknown category</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative bg-white border border-[var(--border)] rounded-2xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-2xl font-semibold text-[var(--text-main)]"
            style={{ fontFamily: "Outfit" }}
          >
            {mode === "create" ? "Create Rule" : "Edit Rule"}
          </h2>
          <button
            onClick={handleClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">{renderFields()}</div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 border border-[var(--border)] rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 px-4 bg-[var(--cta-blue)] text-white rounded-lg hover:bg-blue-600"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
