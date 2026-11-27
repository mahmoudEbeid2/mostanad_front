import { useState } from "react";
import { XCircle, CircleHelp, AlertTriangle, FileText, Database, LayoutGrid, Sparkles, CheckCircle2, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { t } from "../../i18n";

const STATUS_ICON = {
  FAIL: { Icon: XCircle, classes: "text-red-600" },
  NEEDS_CONFIRMATION: { Icon: CircleHelp, classes: "text-orange-600" },
  NEEDS_REVIEW: { Icon: AlertTriangle, classes: "text-purple-600" },
  WARN: { Icon: AlertTriangle, classes: "text-amber-600" },
};

// The three sourced kinds + the one unsourced kind (§ visual distinctness is the point).
const WHY_SOURCE_CONFIG = {
  regulation: { label: t("findingCard.regulation"), Icon: FileText, badge: "bg-indigo-50 text-indigo-800 border-indigo-200", panel: "bg-indigo-50/60 border-indigo-100" },
  your_data: { label: t("findingCard.yourData"), Icon: Database, badge: "bg-rose-50 text-rose-800 border-rose-200", panel: "bg-rose-50/60 border-rose-100" },
  structure: { label: t("findingCard.structure"), Icon: LayoutGrid, badge: "bg-gray-100 text-gray-700 border-gray-300", panel: "bg-gray-50 border-gray-200" },
  plausibility: { label: t("findingCard.plausibilityUnverified"), Icon: Sparkles, badge: "bg-purple-50 text-purple-800 border-purple-200", panel: "bg-purple-50/60 border-purple-100" },
};

const REMEDIATION_TRUST = {
  rule: { label: t("findingCard.sourcedFromTheRegulation"), classes: "text-blue-800", trusted: true },
  product_row: { label: t("findingCard.sourcedFromYourOwnCatalogue"), classes: "text-blue-800", trusted: true },
  reference: { label: t("findingCard.fromAnApprovedReferenceCheck"), classes: "text-sky-800", trusted: true },
  common_practice: { label: t("findingCard.commonPracticeNotAVerified"), classes: "text-amber-800", trusted: false },
  none: { label: t("findingCard.noSourcedFixAvailable"), classes: "text-gray-500", trusted: false },
};

function FixBlock({ v }) {
  const r = v.remediation;
  if (!r || !r.source || r.source === "none") {
    return (
      <p className="text-sm text-gray-500 italic">{t("findingCard.noSourcedFixAvailableNothing")}</p>
    );
  }
  const trust = REMEDIATION_TRUST[r.source] || REMEDIATION_TRUST.none;

  return (
    <div className="space-y-1">
      {r.suggested ? (
        <p className="text-sm font-semibold text-gray-900">{r.suggested}</p>
      ) : r.action ? (
        <p className="text-sm font-semibold text-gray-900 capitalize">{r.action}{" "}{t("findingCard.thisField")}</p>
      ) : null}
      <p className={`text-xs font-medium ${trust.classes}`}>{trust.label}</p>
    </div>
  );
}

function WhyBlock({ v, whyConfig }) {
  // "your_data" covers two different layers: an actual disagreement with the
  // product record (observed/expected both present — show the two values side
  // by side), and an extraction read we're simply not confident about (no
  // record to compare against — show the raw reading instead of fabricating
  // an "(empty)" comparison).
  if (v.whySource === "your_data" && (v.observed != null || v.expected != null)) {
    return (
      <div className="space-y-2">
        {v.message && <p className="text-sm text-gray-800">{v.message}</p>}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-rose-200 bg-white px-2.5 py-2">
            <p className="font-bold uppercase tracking-wide text-rose-700 text-[10px] mb-0.5">{t("findingCard.labelSays")}</p>
            <p className="text-gray-900">{v.observed ?? t("findingCard.empty")}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-white px-2.5 py-2">
            <p className="font-bold uppercase tracking-wide text-rose-700 text-[10px] mb-0.5">{t("findingCard.yourRecordsSay")}</p>
            <p className="text-gray-900">{v.expected ?? t("findingCard.empty")}</p>
          </div>
        </div>
        <p className="text-xs text-rose-900">{t("findingCard.twoWaysToCloseThis")}{" "}<Link to="/products" className="font-bold underline">{t("findingCard.fixItInTheCatalogue")}</Link>.
        </p>
      </div>
    );
  }

  if (v.whySource === "your_data") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-800">{v.message || t("findingCard.weCouldNotReadThis")}</p>
        {v.snippet && (
          <div className="rounded-lg border border-rose-200 bg-white px-2.5 py-2">
            <p className="font-bold uppercase tracking-wide text-rose-700 text-[10px] mb-0.5">{t("findingCard.whatWeRead")}</p>
            <p className="text-gray-900 font-mono">{v.snippet}</p>
          </div>
        )}
      </div>
    );
  }

  if (v.whySource === "structure") {
    return (
      <div className="space-y-1">
        {v.message && <p className="text-sm text-gray-800">{v.message}</p>}
        {v.triggeredBy && <p className="text-sm text-gray-800">{v.triggeredBy[0].toUpperCase() + v.triggeredBy.slice(1)}.</p>}
        <p className="text-xs text-gray-500 italic">{t("findingCard.thisIsARequiredField")}</p>
      </div>
    );
  }

  if (v.whySource === "plausibility") {
    return (
      <div className="space-y-1">
        <p className="text-sm text-gray-800">{v.message}</p>
        <p className="text-xs text-purple-700 italic">{t("findingCard.thisIsAPlausibilityFlag")}</p>
      </div>
    );
  }

  // regulation
  return (
    <div className="space-y-1">
      {v.triggeredBy && <p className="text-sm text-gray-800">{v.triggeredBy[0].toUpperCase() + v.triggeredBy.slice(1)}.</p>}
      {v.message && <p className="text-sm text-gray-800">{v.message}</p>}
      {v.citation && (
        <div className="flex items-start gap-2 mt-1.5 text-xs text-indigo-900 bg-white border border-indigo-100 rounded-lg px-2.5 py-2">
          <whyConfig.Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="italic">"{v.citation}"</p>
            {(v.ruleKey || v.sourceDocumentId) && (
              <p className="mt-1 text-indigo-500 font-mono text-[10px]">
                {[v.ruleKey, v.sourceDocumentId].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FindingCard({ v, onConfirm, confirmed }) {
  const [expanded, setExpanded] = useState(true);
  const statusConf = STATUS_ICON[v.status] || { Icon: AlertTriangle, classes: "text-gray-500" };
  const StatusIcon = statusConf.Icon;
  const whyConfig = WHY_SOURCE_CONFIG[v.whySource] || WHY_SOURCE_CONFIG.structure;

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${confirmed ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-start"
      >
        <StatusIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${statusConf.classes}`} />
        <span className="flex-1 font-bold text-gray-900 text-sm">
          {v.label?.en || v.path}
          {confirmed && <span className="ms-2 text-xs font-normal text-green-700">{t("findingCard.confirmed")}</span>}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 ${whyConfig.badge}`}>
          <whyConfig.Icon className="w-3 h-3" /> {whyConfig.label}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform mt-0.5 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className={`rounded-lg border px-3 py-2.5 ${whyConfig.panel}`}>
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-500 mb-1.5">{t("findingCard.why")}</p>
            <WhyBlock v={v} whyConfig={whyConfig} />
          </div>

          {v.status !== "NEEDS_CONFIRMATION" || v.whySource !== "your_data" ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-500 mb-1.5">{t("findingCard.fix")}</p>
              <FixBlock v={v} />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              {v.confidence != null && (
                <p className="text-xs text-gray-500">{t("findingCard.weReadThisWithConfidence", { round: Math.round(v.confidence * 100) })}</p>
              )}
              {!confirmed ? (
                <button
                  type="button"
                  onClick={() => onConfirm(v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100 flex-shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />{" "}{t("findingCard.confirmThisReadingIsCorrect")}</button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />{" "}{t("findingCard.confirmedForThisCheck")}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
