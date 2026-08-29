import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ChevronDown, FileUp, MessageCircleQuestion, Database, PackageSearch, PackageCheck } from "lucide-react";
import FindingCard from "./FindingCard";
import { localizedText } from "../../utils/localizedText";
import { buildCorrectionListText, downloadCorrectionList } from "../../utils/correctionList";

const FINDING_GROUPS = [
  { key: "mustFix", title: "Must fix", statuses: ["FAIL"], collapsible: false },
  { key: "confirm", title: "Confirm this", statuses: ["NEEDS_CONFIRMATION"], collapsible: false },
  { key: "look", title: "Worth a look", statuses: ["WARN", "NEEDS_REVIEW"], collapsible: true },
];

function numberWord(n) {
  return n === 1 ? "One" : String(n);
}

function pluralThing(n) {
  return n === 1 ? "thing" : "things";
}

function headline(counts) {
  if (counts.FAIL > 0) {
    return `${numberWord(counts.FAIL)} ${pluralThing(counts.FAIL)} to fix before you print this.`;
  }
  if (counts.NEEDS_CONFIRMATION > 0) {
    return `${numberWord(counts.NEEDS_CONFIRMATION)} ${pluralThing(counts.NEEDS_CONFIRMATION)} to confirm before you print this.`;
  }
  const look = (counts.WARN || 0) + (counts.NEEDS_REVIEW || 0);
  if (look > 0) {
    return `Ready to print — ${numberWord(look).toLowerCase()} ${pluralThing(look)} worth a look.`;
  }
  return "Ready to print.";
}

const MATCH_LINE = {
  matched: (candidate) => ({
    text: candidate ? `Compared against "${candidate.name}" in your catalogue.` : "Compared against a matching product in your catalogue.",
    action: { label: "View catalogue", to: "/products" },
    Icon: PackageCheck,
  }),
  similar: (candidate, message) => ({
    text: message || (candidate ? `The closest match was "${candidate.name}", but it wasn't compared against your label — that would treat a different product as this one.` : "A similar product was found, but not compared against this label."),
    action: { label: "Check the match", to: "/products" },
    Icon: PackageSearch,
  }),
  none: () => ({
    text: "This product is not in your catalogue, so nothing was compared against a product record.",
    action: { label: "Browse catalogue", to: "/products" },
    Icon: PackageSearch,
  }),
};

export default function CheckLabelReport({ jobResults, previewUrl, fileIsImage, country }) {
  const [confirmedPaths, setConfirmedPaths] = useState(new Set());
  const [lookOpen, setLookOpen] = useState(false);
  const [passedOpen, setPassedOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  const verdicts = jobResults?.validation?.verdicts || [];
  const productName = localizedText(jobResults?.product?.extractedDetails?.productName) || "This label";
  const form = localizedText(jobResults?.product?.extractedDetails?.pharmaceuticalForm);

  const grouped = useMemo(() => {
    const byPath = new Map();
    for (const v of verdicts) {
      if (!byPath.has(v.path)) byPath.set(v.path, []);
      byPath.get(v.path).push(v);
    }
    const findings = FINDING_GROUPS.map((g) => ({
      ...g,
      verdicts: verdicts.filter((v) => g.statuses.includes(v.status)),
    }));
    const unverifiable = verdicts.filter((v) => v.status === "UNVERIFIABLE");
    const passed = verdicts.filter((v) => v.status === "PASS" || v.status === "NOT_APPLICABLE");
    const counts = verdicts.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});
    return { findings, unverifiable, passed, counts };
  }, [verdicts]);

  const handleConfirm = (v) => {
    setConfirmedPaths((prev) => new Set(prev).add(v.path));
  };

  const handleDownload = () => {
    const text = buildCorrectionListText({
      verdicts,
      productName,
      country,
      unverifiable: grouped.unverifiable,
    });
    downloadCorrectionList(text, `correction-list-${(productName || "label").toLowerCase().replace(/\s+/g, "-")}.txt`);
  };

  const toggleTask = (path) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const hasFindings = grouped.findings.some((g) => g.verdicts.length > 0);
  const matchState = jobResults?.productMatchStatus?.state;
  const matchLine = matchState && MATCH_LINE[matchState]
    ? MATCH_LINE[matchState](jobResults.productMatchStatus.candidate, jobResults.productMatchStatus.message)
    : null;

  return (
    <div className="space-y-8">
      {/* Identity — the uploaded image IS the page identity, no filename banner */}
      <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
        <div className="w-20 h-20 rounded-xl border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-50 flex items-center justify-center">
          {fileIsImage && previewUrl ? (
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <FileUp className="w-8 h-8 text-gray-300" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black text-gray-900 truncate">{productName}</h2>
          <p className="text-sm text-gray-500">
            {[form, country].filter(Boolean).join(" · ") || "No form or country recorded"}
          </p>
        </div>
      </div>

      {/* One answer, in the user's terms */}
      <div>
        <p className="text-2xl font-black text-gray-900">{headline(grouped.counts)}</p>
      </div>

      {/* Findings — every one WHAT / WHY / FIX */}
      {hasFindings && (
        <div className="space-y-5">
          {grouped.findings.map((group) => {
            if (group.verdicts.length === 0) return null;
            const isOpen = group.collapsible ? lookOpen : true;
            return (
              <div key={group.key}>
                <button
                  type="button"
                  disabled={!group.collapsible}
                  onClick={() => group.collapsible && setLookOpen((o) => !o)}
                  className="w-full flex items-center gap-2 mb-3 disabled:cursor-default"
                >
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide">{group.title}</h3>
                  <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{group.verdicts.length}</span>
                  {group.collapsible && (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  )}
                </button>
                {isOpen && (
                  <div className="space-y-3">
                    {group.verdicts.map((v, idx) => (
                      <FindingCard
                        key={`${v.path}-${idx}`}
                        v={v}
                        onConfirm={group.key === "confirm" ? handleConfirm : undefined}
                        confirmed={confirmedPaths.has(v.path)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Primary action, directly under the thing it acts on */}
      <div>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white px-5 py-3 text-sm font-bold shadow-sm"
        >
          <Download className="w-4 h-4" /> Download the correction list
        </button>
        <p className="text-xs text-gray-500 mt-2">A print-ready file for whoever makes the artwork — not an in-app edit.</p>
      </div>

      {/* Things we could not check — tasks, each with one resolving action */}
      {grouped.unverifiable.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
            <MessageCircleQuestion className="w-4 h-4 text-indigo-600" /> Things we could not check
          </h3>
          <div className="space-y-2">
            {grouped.unverifiable.map((v, idx) => {
              const isRulesetGap = v.ruleKey === "NO_AUTHORITATIVE_REQUIREMENTS";
              const key = `${v.path}-${idx}`;
              return (
                <div key={key} className="bg-white rounded-xl border border-indigo-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-800">{v.message || v.label?.en || v.path}</p>
                    {isRulesetGap ? (
                      <Link
                        to="/regulatory-documents"
                        className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
                      >
                        {country ? `Upload ${country}'s rules` : "Upload rules"}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleTask(key)}
                        className="flex-shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        Details
                      </button>
                    )}
                  </div>
                  {!isRulesetGap && expandedTasks.has(key) && v.citation && (
                    <p className="mt-2 text-xs text-gray-500 italic">"{v.citation}"</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-indigo-900 mt-3">
            Until {grouped.unverifiable.length === 1 ? "this is" : "both are"} answered, "{headline(grouped.counts).replace(/\.$/, "")}" is not the whole picture.
          </p>
        </div>
      )}

      {/* Passed checks — one line at the floor */}
      <div className="pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setPassedOpen((o) => !o)}
          className="text-sm text-gray-500 flex items-center gap-1.5 hover:text-gray-700"
        >
          {grouped.passed.length} check{grouped.passed.length === 1 ? "" : "s"} passed
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${passedOpen ? "rotate-180" : ""}`} />
          <span className="underline font-semibold">See every check</span>
        </button>
        {passedOpen && (
          <ul className="mt-3 space-y-1.5 text-xs text-gray-500">
            {grouped.passed.map((v, idx) => (
              <li key={`${v.path}-${idx}`} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                {v.label?.en || v.path}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Product match — one grey line at the very bottom, never fabricated */}
      {matchLine && (
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-2">
          <matchLine.Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{matchLine.text}</span>
          <Link to={matchLine.action.to} className="underline font-semibold text-gray-500 flex-shrink-0">
            {matchLine.action.label}
          </Link>
        </div>
      )}
      {!matchLine && (
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-2">
          <Database className="w-3.5 h-3.5 flex-shrink-0" />
          <span>No product-match information was reported for this check.</span>
        </div>
      )}
    </div>
  );
}
