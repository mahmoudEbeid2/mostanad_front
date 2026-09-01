import { useState } from "react";
import VerdictStatusBadge from "./VerdictStatusBadge";
import { FileText, MapPin, Wrench, ShieldOff, ChevronDown, Pencil, MessageSquareText } from "lucide-react";
import { LABEL_FIELD_CATALOG } from "../utils/labelFieldCatalog";

const SEVERITY_ORDER = {
  FAIL: 0,
  NEEDS_CONFIRMATION: 1,
  UNVERIFIABLE: 2,
  NEEDS_REVIEW: 3,
  WARN: 4,
  NOT_APPLICABLE: 5,
  PASS: 6,
};
const unknownRank = 0.5;

const ACTION_GROUPS = [
  { key: "mustFix", title: "Must fix", statuses: ["FAIL"], defaultOpen: true, classes: "border-red-200 bg-red-50/50", countClasses: "bg-red-100 text-red-800 border-red-200" },
  { key: "confirm", title: "Confirm this", statuses: ["NEEDS_CONFIRMATION"], defaultOpen: true, classes: "border-orange-200 bg-orange-50/50", countClasses: "bg-orange-100 text-orange-800 border-orange-200" },
  { key: "look", title: "Worth a look", statuses: ["WARN", "NEEDS_REVIEW"], defaultOpen: false, classes: "border-amber-200 bg-amber-50/40", countClasses: "bg-amber-100 text-amber-900 border-amber-200" },
  { key: "unchecked", title: "Could not check", statuses: ["UNVERIFIABLE"], defaultOpen: false, classes: "border-indigo-200 bg-indigo-50/40", countClasses: "bg-indigo-100 text-indigo-900 border-indigo-200" },
  { key: "fine", title: "Fine", statuses: ["PASS", "NOT_APPLICABLE"], defaultOpen: false, classes: "border-gray-200 bg-gray-50/50", countClasses: "bg-white text-gray-600 border-gray-200" },
];

const COMPARISON_CONFIG = {
  data_mismatch: { label: "Data mismatch", classes: "bg-rose-50 text-rose-700 border-rose-200" },
  regulatory: { label: "Regulatory", classes: "bg-red-50 text-red-700 border-red-200" },
  coherence: { label: "Internal inconsistency", classes: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  plausibility: { label: "Plausibility flag", classes: "bg-purple-50 text-purple-700 border-purple-200" },
};

const REMEDIATION_SOURCE_LABEL = {
  rule: "from the regulatory rule",
  product_row: "from this product's own data",
  reference: "from an approved reference label",
  none: "no sourced fix available",
};

const FIELD_BY_PATH = Object.fromEntries(LABEL_FIELD_CATALOG.map((field) => [field.path, field]));
const rankOf = (status) => (status in SEVERITY_ORDER ? SEVERITY_ORDER[status] : unknownRank);

function fieldForVerdict(v) {
  return FIELD_BY_PATH[v.path] || LABEL_FIELD_CATALOG.find(
    (field) => v.path?.startsWith(`${field.path}.`) || v.path?.startsWith(`${field.path}[`)
  );
}

function plainStatusCopy(v) {
  switch (v.status) {
    case "FAIL":
      return "This must be fixed before the label is ready.";
    case "NEEDS_CONFIRMATION":
      return "We could not read this confidently. Please confirm the value.";
    case "NEEDS_REVIEW":
      return "This is unusual and worth checking. Treat it as unsourced until a reviewer confirms it.";
    case "UNVERIFIABLE":
      return v.reason || "We could not check this with the approved rules currently on file.";
    case "NOT_APPLICABLE":
      return v.reason || "This rule does not apply to this label.";
    case "WARN":
      return "This is not blocking, but it deserves a look.";
    case "PASS":
      return "This check is fine.";
    default:
      return "This status is not recognized by the UI. Check it manually.";
  }
}

function suggestedAction(v) {
  if (v.remediation?.action) return v.remediation.action;
  if (v.remediation?.suggested) return "Use the suggested value";
  if (v.status === "FAIL") return "Fix this value";
  if (v.status === "NEEDS_CONFIRMATION") return "Confirm the value";
  return null;
}

function RemediationBlock({ remediation }) {
  if (!remediation) return null;
  const sourceIsNone = remediation.source === "none" || !remediation.source;
  return (
    <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 mt-1 border ${sourceIsNone ? "bg-gray-50 border-gray-200 text-gray-500" : "bg-blue-50 border-blue-200 text-blue-900"}`}>
      {sourceIsNone ? <ShieldOff className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <Wrench className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
      <div>
        {sourceIsNone ? (
          <p className="italic">There is a violation here, but no sourced fix is available. Nothing was invented to fill this gap.</p>
        ) : (
          <>
            <p>
              {remediation.action ? `Suggested ${remediation.action}` : "Suggested fix"}
              {remediation.suggested ? `: "${remediation.suggested}"` : ""}
            </p>
            <p className="mt-0.5 text-blue-700">
              {REMEDIATION_SOURCE_LABEL[remediation.source] || remediation.source}
              {remediation.sourceRef?.ruleKey && ` - ${remediation.sourceRef.ruleKey}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function assistantPrompt(v, field) {
  const isVirtualPath = v.path?.startsWith("_");
  const fieldName = field?.label || v.label?.en || (isVirtualPath ? "the label" : v.path) || "this field";
  if (v.remediation?.suggested) return `Fix ${fieldName} by using "${v.remediation.suggested}".`;
  return `Fix ${fieldName}: ${v.message || plainStatusCopy(v)}`;
}

function VerdictCard({ v, detailedView, onEditField, onAskAssistant }) {
  const known = v.status in SEVERITY_ORDER;
  const field = fieldForVerdict(v);
  const action = suggestedAction(v);
  const canEditInline = Boolean(onEditField && field && ["FAIL", "NEEDS_CONFIRMATION", "WARN", "NEEDS_REVIEW"].includes(v.status));

  // Determine a friendly name for the field
  const friendlyName = v.label?.en || field?.label || (detailedView ? v.path : "This field");

  return (
    <div className={`bg-white rounded-xl border p-4 flex flex-col gap-3 ${known ? "border-gray-200" : "border-fuchsia-300 ring-1 ring-fuchsia-200"}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-gray-900 text-sm truncate">{friendlyName}</span>
          {v.label?.ar && <span className="text-gray-500 text-sm" dir="rtl">{v.label.ar}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {detailedView && v.comparison && COMPARISON_CONFIG[v.comparison] && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${COMPARISON_CONFIG[v.comparison].classes}`}>
              {COMPARISON_CONFIG[v.comparison].label}
            </span>
          )}
          {detailedView && <VerdictStatusBadge status={v.status} />}
        </div>
      </div>

      <p className="text-sm text-gray-800">{v.message || plainStatusCopy(v)}</p>
      
      {/* Only show duplicate plain status copy if detailedView is true to avoid clutter */}
      {detailedView && v.message && <p className="text-xs text-gray-500">{plainStatusCopy(v)}</p>}

      {/* Hide the raw "-> add" transition text in normal view, show suggested value plainly */}
      {v.remediation?.suggested && (
        <div className="bg-gray-50 border rounded-lg p-2 text-sm text-gray-800">
          <span className="font-semibold text-gray-600 mr-2">Suggestion:</span>
          {v.remediation.suggested}
        </div>
      )}
      {detailedView && action && !v.remediation?.suggested && (
         <p className="text-xs font-mono text-gray-400">{"->"} {action}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-1">
        {canEditInline && (
          <button
            type="button"
            onClick={() => onEditField(field)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 transition-colors shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit {field.label || "Field"}
          </button>
        )}
        {v.status === "FAIL" && !canEditInline && (
          <button
            type="button"
            onClick={() => onAskAssistant?.(assistantPrompt(v, field))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-100 transition-colors shadow-sm"
            title="Ask the AI Assistant to resolve this issue"
          >
            <MessageSquareText className="w-3.5 h-3.5" /> 💬 Ask Assistant to fix
          </button>
        )}
      </div>

      {detailedView && v.status === "FAIL" && !v.citation && (
        <p className="text-xs text-gray-400 italic mt-2">No citation available for this failure (schema-layer check, not a cited rule).</p>
      )}

      {(v.citation || v.sourceDocumentId) && (
        <details className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-1">
          <summary className="cursor-pointer font-bold text-gray-700">Show rule</summary>
          <div className="flex items-start gap-2 mt-2">
            <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              {v.citation && <p className="italic">"{v.citation}"</p>}
              {v.sourceDocumentId && (
                <p className="mt-1 flex items-center gap-1 text-gray-500">
                  <MapPin className="w-3 h-3" /> Source document: {v.sourceDocumentId}
                </p>
              )}
              {v.ruleKey && <p className="mt-1 font-mono text-gray-400">{v.ruleKey}</p>}
            </div>
          </div>
        </details>
      )}

      {detailedView && <RemediationBlock remediation={v.remediation} />}

      {detailedView && (
        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono uppercase tracking-wide mt-2">
          <span>{v.path}</span>
          {v.ruleKey && <span>- {v.ruleKey}</span>}
          {v.autoFixable && <span className="text-blue-500 font-bold">- auto-fixable</span>}
        </div>
      )}
    </div>
  );
}

function ActionGroup({ group, verdicts, detailedView, onEditField, onAskAssistant }) {
  const [open, setOpen] = useState(group.defaultOpen);

  return (
    <section className={`rounded-2xl border ${group.classes}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-black text-gray-900">{group.title}</span>
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold ${group.countClasses}`}>
          {verdicts.length}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          {verdicts.length > 0 ? (
            verdicts.map((v, idx) => (
              <VerdictCard
                key={`${v.path}-${v.ruleKey || v.status}-${idx}`}
                v={v}
                detailedView={detailedView}
                onEditField={onEditField}
                onAskAssistant={onAskAssistant}
              />
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">Nothing in this group.</p>
          )}
        </div>
      )}
    </section>
  );
}

export default function VerdictList({ verdicts, detailedView = false, onEditField, onAskAssistant }) {
  if (!verdicts || verdicts.length === 0) {
    return <p className="text-sm text-gray-500 italic">No verdicts to show.</p>;
  }

  const groups = new Map();
  for (const v of verdicts) {
    if (!groups.has(v.path)) groups.set(v.path, []);
    groups.get(v.path).push(v);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => rankOf(a.status) - rankOf(b.status));
  }
  const orderedGroups = [...groups.entries()].sort(
    ([, a], [, b]) => rankOf(a[0].status) - rankOf(b[0].status)
  );

  const orderedVerdicts = orderedGroups.flatMap(([, group]) => group);
  const rendered = new Set();
  const actionGroups = ACTION_GROUPS.map((group) => {
    const groupVerdicts = orderedVerdicts.filter((v) => group.statuses.includes(v.status));
    groupVerdicts.forEach((v) => rendered.add(v));
    return { ...group, verdicts: groupVerdicts };
  });
  const unknownVerdicts = orderedVerdicts.filter((v) => !rendered.has(v));

  return (
    <div className="space-y-3">
      {actionGroups.map((group) => (
        <ActionGroup
          key={group.key}
          group={group}
          verdicts={group.verdicts}
          detailedView={detailedView}
          onEditField={onEditField}
          onAskAssistant={onAskAssistant}
        />
      ))}
      {unknownVerdicts.length > 0 && (
        <ActionGroup
          group={{
            key: "unknown",
            title: "Needs manual check",
            defaultOpen: true,
            classes: "border-fuchsia-200 bg-fuchsia-50/50",
            countClasses: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
          }}
          verdicts={unknownVerdicts}
          detailedView
          onEditField={onEditField}
          onAskAssistant={onAskAssistant}
        />
      )}
    </div>
  );
}
