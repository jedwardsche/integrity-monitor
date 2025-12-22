import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRules } from "../hooks/useRules";
import type { RulesByCategory } from "../hooks/useRules";
import { useAuth } from "../hooks/useAuth";
import { RuleEditor } from "../components/RuleEditor";
import { AIRuleCreator } from "../components/AIRuleCreator";
import ConfirmModal from "../components/ConfirmModal";
import trashIcon from "../assets/trash.svg";

type Category =
  | "duplicates"
  | "relationships"
  | "required_fields"
  | "attendance_rules";

const CATEGORY_LABELS: Record<Category, string> = {
  duplicates: "Duplicate Rules",
  relationships: "Relationship Rules",
  required_fields: "Required Field Rules",
  attendance_rules: "Attendance Rules",
};

export function RulesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadRules, createRule, updateRule, deleteRule, loading, error } =
    useRules();
  const [rules, setRules] = useState<RulesByCategory | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("duplicates");
  const [showAICreator, setShowAICreator] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<{
    category: string;
    entity?: string;
    ruleId: string;
    rule: Record<string, any>;
  } | null>(null);
  const [deletingRule, setDeletingRule] = useState<{
    category: string;
    entity?: string;
    ruleId: string;
  } | null>(null);

  useEffect(() => {
    // Only fetch rules if user is authenticated
    if (user) {
      fetchRules();
    }
  }, [user]);

  const fetchRules = async () => {
    try {
      const data = await loadRules();
      setRules(data);
    } catch (err) {
      console.error("Failed to load rules:", err);
      // Set empty rules structure on error so UI doesn't hang
      setRules({
        duplicates: {},
        relationships: {},
        required_fields: {},
        attendance_rules: {},
      });
    }
  };

  const handleCreateRule = async (parsedRule: {
    category: string;
    entity: string | null;
    rule_data: Record<string, any>;
  }) => {
    try {
      await createRule(
        parsedRule.category,
        parsedRule.entity,
        parsedRule.rule_data
      );
      await fetchRules();
      setShowAICreator(false);
    } catch (err) {
      console.error("Failed to create rule:", err);
    }
  };

  const handleSaveRule = async (ruleData: Record<string, any>) => {
    if (!editingRule) return;

    try {
      if (editingRule.ruleId) {
        await updateRule(
          editingRule.category,
          editingRule.ruleId,
          editingRule.entity || null,
          ruleData
        );
      } else {
        await createRule(
          editingRule.category,
          editingRule.entity || null,
          ruleData
        );
      }
      await fetchRules();
      setShowEditor(false);
      setEditingRule(null);
    } catch (err) {
      console.error("Failed to save rule:", err);
    }
  };

  const handleDeleteClick = (
    category: string,
    entity: string | undefined,
    ruleId: string
  ) => {
    setDeletingRule({ category, entity, ruleId });
  };

  const handleConfirmDelete = async () => {
    if (!deletingRule) return;

    try {
      await deleteRule(
        deletingRule.category,
        deletingRule.ruleId,
        deletingRule.entity || null
      );
      await fetchRules();
      setDeletingRule(null);
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const renderDuplicateRules = () => {
    if (!rules?.duplicates) return null;

    return Object.entries(rules.duplicates).map(
      ([entity, entityRules]: [string, any]) => (
        <div key={entity} className="mb-6">
          <h3 className="text-lg font-semibold text-[var(--text-main)] mb-3 capitalize">
            {entity}
          </h3>
          <div className="space-y-4">
            {entityRules.likely && entityRules.likely.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  Likely Duplicates
                </h4>
                {entityRules.likely.map((rule: any, idx: number) => (
                  <RuleCard
                    key={idx}
                    rule={rule}
                    entity={entity}
                    category="duplicates"
                    ruleId={rule.rule_id}
                    onView={() =>
                      navigate(`/rules/duplicates/${entity}/${rule.rule_id}`)
                    }
                    onDelete={() =>
                      handleDeleteClick("duplicates", entity, rule.rule_id)
                    }
                  />
                ))}
              </div>
            )}
            {entityRules.possible && entityRules.possible.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">
                  Possible Duplicates
                </h4>
                {entityRules.possible.map((rule: any, idx: number) => (
                  <RuleCard
                    key={idx}
                    rule={rule}
                    entity={entity}
                    category="duplicates"
                    ruleId={rule.rule_id}
                    onView={() =>
                      navigate(`/rules/duplicates/${entity}/${rule.rule_id}`)
                    }
                    onDelete={() =>
                      handleDeleteClick("duplicates", entity, rule.rule_id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )
    );
  };

  const renderRelationshipRules = () => {
    if (!rules?.relationships) return null;

    return Object.entries(rules.relationships).map(
      ([entity, entityRels]: [string, any]) => (
        <div key={entity} className="mb-6">
          <h3 className="text-lg font-semibold text-[var(--text-main)] mb-3 capitalize">
            {entity}
          </h3>
          <div className="space-y-3">
            {Object.entries(entityRels).map(
              ([relKey, relRule]: [string, any]) => (
                <RuleCard
                  key={relKey}
                  rule={relRule}
                  entity={entity}
                  category="relationships"
                  ruleId={relKey}
                  onView={() =>
                    navigate(`/rules/relationships/${entity}/${relKey}`)
                  }
                  onDelete={() =>
                    handleDeleteClick("relationships", entity, relKey)
                  }
                />
              )
            )}
          </div>
        </div>
      )
    );
  };

  const renderRequiredFieldRules = () => {
    if (!rules?.required_fields) return null;

    return Object.entries(rules.required_fields).map(
      ([entity, fields]: [string, any]) => (
        <div key={entity} className="mb-6">
          <h3 className="text-lg font-semibold text-[var(--text-main)] mb-3 capitalize">
            {entity}
          </h3>
          <div className="space-y-3">
            {Array.isArray(fields) &&
              fields.map((fieldRule: any, idx: number) => (
                <RuleCard
                  key={idx}
                  rule={fieldRule}
                  entity={entity}
                  category="required_fields"
                  ruleId={fieldRule.field || fieldRule.rule_id}
                  onView={() =>
                    navigate(
                      `/rules/required_fields/${entity}/${
                        fieldRule.field || fieldRule.rule_id
                      }`
                    )
                  }
                  onDelete={() =>
                    handleDeleteClick(
                      "required_fields",
                      entity,
                      fieldRule.field || fieldRule.rule_id
                    )
                  }
                />
              ))}
          </div>
        </div>
      )
    );
  };

  const renderAttendanceRules = () => {
    if (!rules?.attendance_rules) return null;

    return (
      <div>
        <RuleCard
          rule={rules.attendance_rules}
          category="attendance_rules"
          ruleId="attendance_rules"
          onView={() => navigate(`/rules/attendance_rules/_/attendance_rules`)}
          onDelete={() =>
            handleDeleteClick("attendance_rules", undefined, "attendance_rules")
          }
        />
      </div>
    );
  };

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case "duplicates":
        return renderDuplicateRules();
      case "relationships":
        return renderRelationshipRules();
      case "required_fields":
        return renderRequiredFieldRules();
      case "attendance_rules":
        return renderAttendanceRules();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-semibold text-[var(--text-main)] mb-2"
            style={{ fontFamily: "Outfit" }}
          >
            Rules Management
          </h1>
          <p className="text-[var(--text-muted)]">
            View, create, edit, and delete data integrity rules
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setEditingRule({
                category: activeCategory,
                ruleId: "",
                rule: {},
              });
              setShowEditor(true);
            }}
            className="px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-gray-50"
          >
            + Create Rule Manually
          </button>
          <button
            onClick={() => setShowAICreator(true)}
            className="px-4 py-2 bg-[var(--cta-blue)] text-white rounded-lg hover:bg-blue-600"
          >
            + Create Rule with AI
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === category
                ? "text-[var(--cta-blue)] border-b-2 border-[var(--cta-blue)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      {/* Rules Content */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
        {loading ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            Loading rules...
          </div>
        ) : (
          renderCategoryContent()
        )}
      </div>

      {/* Modals */}
      <AIRuleCreator
        isOpen={showAICreator}
        onClose={() => setShowAICreator(false)}
        onRuleParsed={handleCreateRule}
      />

      {showEditor && editingRule && (
        <RuleEditor
          isOpen={showEditor}
          onClose={() => {
            setShowEditor(false);
            setEditingRule(null);
          }}
          onSave={handleSaveRule}
          category={editingRule.category}
          entity={editingRule.entity}
          initialRule={editingRule.rule}
          mode={editingRule.ruleId ? "edit" : "create"}
        />
      )}

      <ConfirmModal
        isOpen={deletingRule !== null}
        title="Delete Rule"
        message={`Are you sure you want to delete this rule? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingRule(null)}
      />
    </div>
  );
}

interface RuleCardProps {
  rule: Record<string, any>;
  category: string;
  entity?: string;
  ruleId?: string;
  onView: () => void;
  onDelete: () => void;
}

function RuleCard({
  rule,
  category,
  entity,
  ruleId,
  onView,
  onDelete,
}: RuleCardProps) {
  const source = rule.source || "yaml";
  const isFirestore = source === "firestore";

  return (
    <div className="p-4 border border-[var(--border)] rounded-lg hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-[var(--text-main)]">
              {rule.rule_id || ruleId || rule.field || "Rule"}
            </h4>
            {isFirestore && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                Firestore
              </span>
            )}
            {!isFirestore && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                YAML Base
              </span>
            )}
            {rule.severity && (
              <span
                className={`px-2 py-1 text-xs rounded ${
                  rule.severity === "critical"
                    ? "bg-red-100 text-red-800"
                    : rule.severity === "warning"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {rule.severity}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-2">
            {rule.description ||
              rule.message ||
              JSON.stringify(rule, null, 2).substring(0, 100)}
          </p>
          {category === "relationships" && (
            <div className="text-xs text-[var(--text-muted)]">
              Target: {rule.target} | Min: {rule.min_links || 0} | Max:{" "}
              {rule.max_links || "∞"}
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={onView}
            className="p-2 text-[var(--cta-blue)] hover:bg-blue-50 rounded transition-colors"
            title="View Details"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
          {isFirestore && (
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-50 rounded transition-colors"
              title="Delete Rule"
            >
              <img
                src={trashIcon}
                alt="Delete"
                className="w-5 h-5"
                style={{
                  filter:
                    "brightness(0) saturate(100%) invert(20%) sepia(100%) saturate(5000%) hue-rotate(350deg) brightness(90%) contrast(100%)",
                }}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
