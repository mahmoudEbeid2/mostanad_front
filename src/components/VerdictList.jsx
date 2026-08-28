import VerdictStatusBadge from "./VerdictStatusBadge";
import { FileText, MapPin, Wrench, ShieldOff } from "lucide-react";

// D1: FAIL always shows its citation — the user needs to see which rule and which
// source document, not just that something failed. UNVERIFIABLE/NEEDS_CONFIRMATION/
// NEEDS_REVIEW/NOT_APPLICABLE are each rendered with their own distinct badge (see
// VerdictStatusBadge), never folded into PASS or WARN. An unrecognized status sorts
// near the top, not the bottom — burying a status this UI doesn't understand would be
// a silent misrepresentation of a regulated result.
const SEVERITY_ORDER = {
  FAIL: 0,
  NEEDS_CONFIRMATION: 1,
  UNVERIFIABLE: 2,
  NEEDS_REVIEW: 3,
  WARN: 4,
  NOT_APPLICABLE: 5,
  PASS: 6,
};
const unknownRank = 0.5; // between FAIL and NEEDS_CONFIRMATION — impossible to miss

const rankOf = (status) => (status in SEVERITY_ORDER ? SEVERITY_ORDER[status] : unknownRank);

// §14.5.1: comparison tells the user WHERE a failure came from — a wrong printed
// number (data_mismatch) is a different problem from a missing legal warning
// (regulatory), and both are different from an internal contradiction (coherence)
// or a merely-suspicious value (plausibility). Never rendered as interchangeable.
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

function RemediationBlock({ remediation }) {
  if (!remediation) return null;
  const sourceIsNone = remediation.source === "none" || !remediation.source;
  return (
    <div
      className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 mt-1 border ${
        sourceIsNone ? "bg-gray-50 border-gray-200 text-gray-500" : "bg-blue-50 border-blue-200 text-blue-900"
      }`}
    >
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
              {remediation.sourceRef?.ruleKey && ` — ${remediation.sourceRef.ruleKey}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function VerdictCard({ v }) {
  const known = v.status in SEVERITY_ORDER;
  return (
    <div
      className={`bg-white rounded-xl border p-4 flex flex-col gap-2 ${
        known ? "border-gray-200" : "border-fuchsia-300 ring-1 ring-fuchsia-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-gray-900 text-sm truncate">
            {v.label?.en || v.path}
          </span>
          {v.label?.ar && (
            <span className="text-gray-500 text-sm" dir="rtl">{v.label.ar}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {v.comparison && COMPARISON_CONFIG[v.comparison] && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${COMPARISON_CONFIG[v.comparison].classes}`}>
              {COMPARISON_CONFIG[v.comparison].label}
            </span>
          )}
          <VerdictStatusBadge status={v.status} />
        </div>
      </div>

      {v.message && <p className="text-sm text-gray-700">{v.message}</p>}

      {v.status === "FAIL" && !v.citation && (
        <p className="text-xs text-gray-400 italic">No citation available for this failure (schema-layer check, not a cited rule).</p>
      )}

      {(v.citation || v.sourceDocumentId) && (
        <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-1">
          <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            {v.citation && <p className="italic">&ldquo;{v.citation}&rdquo;</p>}
            {v.sourceDocumentId && (
              <p className="mt-1 flex items-center gap-1 text-gray-500">
                <MapPin className="w-3 h-3" /> Source document: {v.sourceDocumentId}
              </p>
            )}
          </div>
        </div>
      )}

      <RemediationBlock remediation={v.remediation} />

      <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono uppercase tracking-wide">
        <span>{v.path}</span>
        {v.ruleKey && <span>· {v.ruleKey}</span>}
        {v.autoFixable && <span className="text-blue-500 font-bold">· auto-fixable</span>}
      </div>
    </div>
  );
}

export default function VerdictList({ verdicts }) {
  if (!verdicts || verdicts.length === 0) {
    return <p className="text-sm text-gray-500 italic">No verdicts to show.</p>;
  }

  // Group by path so sibling verdicts on the same field (e.g. two layers judging
  // activeIngredients differently) stay visually adjacent — severest first within
  // the group — instead of being scattered by a flat global sort. Groups themselves
  // are ordered by their most severe member. Nothing is deduplicated or dropped.
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

  return (
    <div className="space-y-3">
      {orderedGroups.map(([path, group]) => (
        <div key={path} className={group.length > 1 ? "space-y-1.5 border-l-2 border-gray-200 pl-3" : ""}>
          {group.map((v, idx) => (
            <VerdictCard key={`${path}-${idx}`} v={v} />
          ))}
        </div>
      ))}
    </div>
  );
}
