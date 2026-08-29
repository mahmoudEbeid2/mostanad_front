import { Pencil } from "lucide-react";
import VerdictList from "./VerdictList";
import ProvenanceBadge from "./ProvenanceBadge";
import { LABEL_FIELD_CATALOG, fieldHasContent, verdictsForField, provenanceForField } from "../utils/labelFieldCatalog";

function EstimatedBadge() {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
      Estimated
    </span>
  );
}

function FieldValue({ field, value }) {
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
export default function LabelFieldsPanel({ labelData, verdicts, provenance, onEditField, detailedView = false }) {
  if (!labelData) return null;
  const estimatedFields = labelData.estimatedFields || [];

  const rows = LABEL_FIELD_CATALOG.filter((f) => fieldHasContent(labelData, f));

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
          <div key={field.path} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">{field.label}</span>
                {isEstimated && <EstimatedBadge />}
                <ProvenanceBadge entries={fieldProvenance} detailed={detailedView} />
              </div>
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

            <FieldValue field={field} value={labelData[field.path]} />

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
