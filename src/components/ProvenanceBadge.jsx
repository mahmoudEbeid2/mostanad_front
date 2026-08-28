import { useState } from "react";
import { ShieldCheck, FileSearch, BookMarked, Globe2, PenLine, ChevronDown } from "lucide-react";

// §8.2's tier ladder + §14.4's provenance graph, surfaced per field so a user can see
// exactly how confident the system is in a value and where it came from.
const PROVENANCE_CONFIG = {
  confirmed: { label: "Confirmed", icon: ShieldCheck, classes: "bg-green-50 text-green-800 border-green-200" },
  extracted: { label: "Extracted", icon: FileSearch, classes: "bg-amber-50 text-amber-800 border-amber-200" },
  reference: { label: "Reference", icon: BookMarked, classes: "bg-blue-50 text-blue-800 border-blue-200" },
  external: { label: "External", icon: Globe2, classes: "bg-purple-50 text-purple-800 border-purple-200" },
  inferred: { label: "Inferred", icon: FileSearch, classes: "bg-amber-50 text-amber-800 border-amber-200" },
  manual: { label: "Manual Edit", icon: PenLine, classes: "bg-gray-50 text-gray-700 border-gray-200" },
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

// entries: provenanceForField() output — usually 1, sometimes several nested paths
// under one field (e.g. targetAnimalSpecies.list vs. .translations.en).
export default function ProvenanceBadge({ entries }) {
  const [open, setOpen] = useState(false);
  if (!entries || entries.length === 0) return null;

  const primary = entries[0];
  const config = PROVENANCE_CONFIG[primary.provenance] || {
    label: primary.provenance || "Unknown",
    icon: FileSearch,
    classes: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const Icon = config.icon;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${config.classes}`}
      >
        <Icon className="w-3 h-3" /> {config.label}
        {primary.tier != null && <span className="opacity-70">· tier {primary.tier}</span>}
        {entries.length > 1 && <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-2 text-xs text-gray-700">
          {entries.map((e) => (
            <div key={e.key} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
              <p className="font-mono text-[10px] text-gray-400">{e.key}</p>
              <p className="font-bold text-gray-900">{PROVENANCE_CONFIG[e.provenance]?.label || e.provenance} · tier {e.tier}</p>
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
