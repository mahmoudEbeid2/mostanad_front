import { Pencil, MessageSquarePlus } from "lucide-react";
import VerdictList from "./VerdictList";
import ProvenanceBadge from "./ProvenanceBadge";
import { LABEL_FIELD_CATALOG, fieldHasContent, verdictsForField, provenanceForField } from "../utils/labelFieldCatalog";

function EstimatedSourceInfo({ entries }) {
  if (!entries || entries.length === 0) return <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border-amber-200 px-1.5 py-0.5 rounded-full border">AI Estimate</span>;
  const primary = entries[0];
  let text = "Estimated by AI from general knowledge. This is the least trustworthy value on the page.";
  if (primary.provenance === "reference") {
    text = `From approved reference: ${primary.sourceRef?.id || "Unknown"}`;
  } else if (primary.provenance === "external") {
    text = `From authoritative source${primary.sourceUrl ? " (has citation)" : ""}`;
  }
  return (
    <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 px-2 py-1 rounded-md flex flex-col">
      <span className="font-bold uppercase text-[10px] tracking-wide mb-0.5">Estimated Value</span>
      <span>{text}</span>
      {primary.sourceUrl && <a href={primary.sourceUrl} target="_blank" rel="noreferrer" className="underline mt-0.5 break-all">{primary.sourceUrl}</a>}
    </div>
  );
}

function FieldValue({ field, value, provenance }) {
  const primaryProv = provenance?.[0];
  const refusalReason = primaryProv?.refusalReason;
  
  if (refusalReason && (value === null || value === undefined || value === "")) {
    return <p className="text-sm text-gray-500 italic bg-gray-50 border-l-2 border-gray-300 pl-3 py-1 flex-1">{refusalReason}</p>;
  }

  switch (field.type) {
    case "localized":
      if (!value?.translations) return <p className="text-sm text-gray-400 italic flex-1">Not applicable to this product.</p>;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
          {value.translations.en && <p className="text-sm text-gray-900">{value.translations.en}</p>}
          {value.translations.ar && <p className="text-sm text-gray-900 text-right" dir="rtl">{value.translations.ar}</p>}
        </div>
      );
    case "localizedArray":
      return (
        <ul className="space-y-2 flex-1">
          {(value || []).map((v, i) => (
            <li key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-900">
              {v.translations?.en && <p>{v.translations.en}</p>}
              {v.translations?.ar && <p className="text-right" dir="rtl">{v.translations.ar}</p>}
            </li>
          ))}
        </ul>
      );
    case "ingredients":
      return (
        <ul className="space-y-1 flex-1">
          {(value || []).map((ing, i) => (
            <li key={i} className="text-sm text-gray-900">
              {ing.translations?.en} {ing.translations?.ar ? `(${ing.translations.ar})` : ""} — {ing.amount}
              {ing.unit || ""}
              {ing.normalizedName && <span className="text-gray-400 text-xs ml-1">[{ing.normalizedName}]</span>}
            </li>
          ))}
        </ul>
      );
    case "analysis":
      if (!value) return <p className="text-sm text-gray-400 italic flex-1">Not applicable to this product.</p>;
      return (
        <div className="flex-1 text-sm text-gray-900">
          <p className="text-xs text-gray-500 mb-1">Basis: {value.basis}</p>
          <ul className="space-y-0.5">
            {(value.items || []).map((it, i) => (
              <li key={i}>{it.name}: {it.value}</li>
            ))}
          </ul>
        </div>
      );
    case "targetSpecies":
      return (
        <div className="flex-1">
          <p className="text-sm text-gray-900">{(value?.list || []).join(", ")}</p>
          {value?.source && (
            <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
              species source: {value.source}
            </span>
          )}
        </div>
      );
    case "boolean":
      return <p className="text-sm text-gray-900 flex-1">{value ? "Yes" : "No"}</p>;
    case "string":
    default:
      return <p className="text-sm text-gray-900 flex-1">{value ?? "—"}</p>;
  }
}

// The core detail surface: every label field alongside its per-field verdicts and
// provenance, in one place — not a 6-field summary, not a raw-JSON dump.
export default function LabelFieldsPanel({ labelData, verdicts, provenance, onEditField, onAskAssistant, detailedView = false, showOnlyEstimated = false }) {
  if (!labelData) return null;
  const estimatedFields = labelData.estimatedFields || [];

  let rows = LABEL_FIELD_CATALOG.filter((f) => fieldHasContent(labelData, f) || provenanceForField(provenance, f.path)?.[0]?.refusalReason);
  if (showOnlyEstimated) {
    rows = rows.filter(f => estimatedFields.includes(f.path));
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 italic">This label has no populated fields.</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((field) => {
        const fieldVerdicts = verdictsForField(verdicts, field.path);
        const fieldProvenance = provenanceForField(provenance, field.path);
        const isEstimated = estimatedFields.includes(field.path);

        return (
          <div key={field.path} className={`rounded-2xl border p-5 ${isEstimated ? "bg-amber-50/30 border-amber-400 border-l-4" : "bg-white border-gray-200"}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">{field.label}</span>
                  <ProvenanceBadge entries={fieldProvenance} detailed={detailedView} />
                </div>
                {isEstimated && <EstimatedSourceInfo entries={fieldProvenance} />}
              </div>
              
              <div className="flex items-center gap-3">
                {isEstimated && onAskAssistant && (
                  <button
                    type="button"
                    onClick={() => onAskAssistant(`I need to correct the ${field.label}. `)}
                    className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 bg-purple-50 px-2 py-1 rounded"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" /> Ask Assistant
                  </button>
                )}
                {onEditField && (
                  <button
                    type="button"
                    onClick={() => onEditField(field)}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>

            <FieldValue field={field} value={labelData[field.path]} provenance={fieldProvenance} />

            {detailedView && fieldVerdicts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <VerdictList verdicts={fieldVerdicts} detailedView={detailedView} onEditField={onEditField} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
