import VerdictStatusBadge from "./VerdictStatusBadge";
import { FileText, MapPin } from "lucide-react";

// D1: FAIL always shows its citation — the user needs to see which rule and which
// source document, not just that something failed. UNVERIFIABLE/NOT_APPLICABLE are
// rendered with their own distinct badge (see VerdictStatusBadge), never folded
// into PASS or WARN.
const SEVERITY_ORDER = { FAIL: 0, UNVERIFIABLE: 1, WARN: 2, NOT_APPLICABLE: 3, PASS: 4 };

export default function VerdictList({ verdicts }) {
  if (!verdicts || verdicts.length === 0) {
    return <p className="text-sm text-gray-500 italic">No verdicts to show.</p>;
  }

  const sorted = [...verdicts].sort(
    (a, b) => (SEVERITY_ORDER[a.status] ?? 99) - (SEVERITY_ORDER[b.status] ?? 99)
  );

  return (
    <div className="space-y-3">
      {sorted.map((v, idx) => (
        <div
          key={`${v.path}-${idx}`}
          className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2"
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
            <VerdictStatusBadge status={v.status} />
          </div>

          {v.message && <p className="text-sm text-gray-700">{v.message}</p>}

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

          <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono uppercase tracking-wide">
            <span>{v.path}</span>
            {v.ruleKey && <span>· {v.ruleKey}</span>}
            {v.autoFixable && <span className="text-blue-500 font-bold">· auto-fixable</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
