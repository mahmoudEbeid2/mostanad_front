import { useState } from "react";
import { ShieldCheck, FileSearch, BookMarked, Globe2, PenLine, ChevronDown } from "lucide-react";

const PROVENANCE_CONFIG = {
  confirmed: { label: "Confirmed", icon: ShieldCheck, classes: "bg-green-50 text-green-800 border-green-200" },
  extracted: { label: "Extracted", icon: FileSearch, classes: "bg-amber-50 text-amber-800 border-amber-200" },
  reference: { label: "Reference", icon: BookMarked, classes: "bg-blue-50 text-blue-800 border-blue-200" },
  external: { label: "External", icon: Globe2, classes: "bg-purple-50 text-purple-800 border-purple-200" },
  inferred: { label: "Inferred", icon: FileSearch, classes: "bg-amber-50 text-amber-800 border-amber-200" },
  manual: { label: "Manual Edit", icon: PenLine, classes: "bg-gray-50 text-gray-700 border-gray-200" },
};

const SIMPLE_PROVENANCE_CONFIG = {
  confirmed: { label: "Confirmed", icon: ShieldCheck, classes: "bg-green-50 text-green-800 border-green-200" },
  reference: { label: "Approved reference", icon: BookMarked, classes: "bg-sky-50 text-sky-800 border-sky-200" },
  estimate: { label: "AI estimate", icon: FileSearch, classes: "bg-amber-50 text-amber-900 border-amber-300" },
};

function sourceRefSummary(sourceRef) {
  if (!sourceRef) return null;
  switch (sourceRef.kind) {
    case "product_row":
      return `From this product's record (field: ${sourceRef.field})`;
    case "reference_label":
      return `From reference label ${sourceRef.id}${sourceRef.matchTier ? ` (${sourceRef.matchTier})` : ""}${sourceRef.score ? `, match score ${sourceRef.score}` : ""}`;
    default:
      return sourceRef.id ? `${sourceRef.kind || "source"}: ${sourceRef.id}` : sourceRef.kind || null;
  }
}

function simplifiedProvenance(provenance) {
  if (provenance === "inferred" || provenance === "external") return "estimate";
  if (provenance === "reference") return "reference";
  return "confirmed";
}

export default function ProvenanceBadge({ entries, detailed = false }) {
  const [open, setOpen] = useState(false);
  if (!entries || entries.length === 0) return null;

  const primary = entries[0];
  const simpleKey = simplifiedProvenance(primary.provenance);
  if (!detailed && simpleKey === "confirmed") return null;

  const config = detailed
    ? PROVENANCE_CONFIG[primary.provenance] || {
        label: primary.provenance || "Unknown",
        icon: FileSearch,
        classes: "bg-gray-50 text-gray-600 border-gray-200",
      }
    : SIMPLE_PROVENANCE_CONFIG[simpleKey];
  const Icon = config.icon;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${config.classes}`}
      >
        <Icon className="w-3 h-3" /> {config.label}
        {detailed && primary.tier != null && <span className="opacity-70">tier {primary.tier}</span>}
        {entries.length > 1 && <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-2 text-xs text-gray-700">
          {entries.map((e) => (
            <div key={e.key} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
              <p className="font-mono text-[10px] text-gray-400">{e.key}</p>
              <p className="font-bold text-gray-900">
                {PROVENANCE_CONFIG[e.provenance]?.label || e.provenance}
                {e.tier != null ? ` - tier ${e.tier}` : ""}
              </p>
              {sourceRefSummary(e.sourceRef) && <p className="mt-0.5">{sourceRefSummary(e.sourceRef)}</p>}
              {e.selfConsistency && (
                <p className="mt-0.5 text-gray-500">
                  Self-consistency: {e.selfConsistency.agreed ? "agreed" : "disagreed"} across {e.selfConsistency.runs} runs
                </p>
              )}
              {e.at && <p className="mt-0.5 text-gray-400">{new Date(e.at).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
