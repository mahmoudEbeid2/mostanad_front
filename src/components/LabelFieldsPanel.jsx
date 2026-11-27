import { Pencil, MessageSquarePlus } from "lucide-react";
import VerdictList from "./VerdictList";
import ProvenanceBadge from "./ProvenanceBadge";
import { LABEL_FIELD_CATALOG, LABEL_SECTIONS, fieldHasContent, verdictsForField, provenanceForField } from "../utils/labelFieldCatalog";
import { t } from "../i18n";

function EstimatedSourceInfo({ entries }) {
  const primary = (entries || []).find((e) => e.estimated) || entries?.[0];
  if (!primary) return <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border-amber-200 px-1.5 py-0.5 rounded-full border">{t("labelFieldsPanel.aiEstimate")}</span>;
  // estimateBasis is the backend's plain-language "what it was inferred from" —
  // always prefer it over the generic provenance-tier text below.
  let text = primary.estimateBasis || t("labelFieldsPanel.estimatedByAiFromGeneral");
  if (!primary.estimateBasis && primary.provenance === "reference") {
    text = t("labelFieldsPanel.fromReference", { id: primary.sourceRef?.id || "—" });
  } else if (!primary.estimateBasis && primary.provenance === "external") {
    text = t(primary.sourceUrl ? "labelFieldsPanel.fromSourceCited" : "labelFieldsPanel.fromSource");
  }
  return (
    <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 px-2 py-1 rounded-md flex flex-col">
      <span className="font-bold uppercase text-[10px] tracking-wide mb-0.5">{t("labelFieldsPanel.estimatedValue")}</span>
      <span>{text}</span>
      {primary.sourceUrl && <a href={primary.sourceUrl} target="_blank" rel="noreferrer" className="underline mt-0.5 break-all">{primary.sourceUrl}</a>}
    </div>
  );
}

function FieldValue({ field, value, provenance }) {
  const primaryProv = provenance?.[0];
  const refusalReason = primaryProv?.refusalReason;
  
  if (refusalReason && (value === null || value === undefined || value === "")) {
    return <p className="text-sm text-gray-500 italic bg-gray-50 border-s-2 border-gray-300 ps-3 py-1 flex-1">{refusalReason}</p>;
  }

  switch (field.type) {
    case "localized":
      if (!value?.translations) return <p className="text-sm text-gray-400 italic flex-1">{t("labelFieldsPanel.notApplicableToThisProduct")}</p>;
      if (!value.translations.en && !value.translations.ar && !value.primary) {
        return (
          <p className="text-sm text-amber-800 italic bg-amber-50 border-s-2 border-amber-300 ps-3 py-1 flex-1">{t("labelFieldsPanel.presentButEmptyTheSystem")}</p>
        );
      }
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
          {value.translations.en && <p className="text-sm text-gray-900">{value.translations.en}</p>}
          {value.translations.ar && <p className="text-sm text-gray-900 text-end" dir="rtl">{value.translations.ar}</p>}
        </div>
      );
    case "localizedArray":
      return (
        <ul className="space-y-2 flex-1">
          {(value || []).map((v, i) => (
            <li key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-900">
              {v.translations?.en && <p>{v.translations.en}</p>}
              {v.translations?.ar && <p className="text-end" dir="rtl">{v.translations.ar}</p>}
            </li>
          ))}
        </ul>
      );
    case "ingredients":
      return (
        <ul className="space-y-1 flex-1">
          {(value || []).map((ing, i) => {
            const amountPath = `activeIngredients[${i}].amount`;
            const amountProv = (provenance || []).find((p) => p.key === amountPath);
            const amountEstimated = Boolean(amountProv?.estimated);
            return (
              <li key={i} className="text-sm text-gray-900">
                <span>
                  {ing.translations?.en} {ing.translations?.ar ? `(${ing.translations.ar})` : ""} —{" "}
                  {amountEstimated ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                        {ing.amount || t("labelFieldsPanel.none")}{ing.unit || ""}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">{t("labelFieldsPanel.estimated")}</span>
                    </span>
                  ) : (
                    <>{ing.amount}{ing.unit || ""}</>
                  )}
                  {ing.normalizedName && <span className="text-gray-400 text-xs ms-1">[{ing.normalizedName}]</span>}
                </span>
                {amountEstimated && (
                  <p className="mt-0.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    {amountProv.estimateBasis || t("labelFieldsPanel.estimatedByAiNoConfirmed")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      );
    case "analysis":
      if (!value) return <p className="text-sm text-gray-400 italic flex-1">{t("labelFieldsPanel.notApplicableToThisProduct")}</p>;
      return (
        <div className="flex-1 text-sm text-gray-900">
          <p className="text-xs text-gray-500 mb-1">{t("labelFieldsPanel.basis")}{" "}{value.basis}</p>
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
            <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">{t("labelFieldsPanel.speciesSource", { source: value.source })}</span>
          )}
        </div>
      );
    case "boolean":
      return <p className="text-sm text-gray-900 flex-1">{value ? t("labelFieldsPanel.yes") : t("labelFieldsPanel.no")}</p>;
    case "string":
    default:
      if (value === "" && NEVER_EMPTY_STRING_FIELDS.has(field.path)) {
        return (
          <p className="text-sm text-amber-800 italic bg-amber-50 border-s-2 border-amber-300 ps-3 py-1 flex-1">{t("labelFieldsPanel.presentButEmptyTheSystem")}</p>
        );
      }
      return <p className="text-sm text-gray-900 flex-1">{value === "" ? "—" : value ?? "—"}</p>;
  }
}

function IconButton({ onClick, title, tone = "gray", children }) {
  const toneClasses = {
    gray: "text-gray-400 hover:text-gray-700 hover:bg-gray-100",
    purple: "text-purple-500 hover:text-purple-700 hover:bg-purple-50",
    blue: "text-blue-500 hover:text-blue-700 hover:bg-blue-50",
  };
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`p-1.5 rounded-md transition-colors ${toneClasses[tone]}`}>
      {children}
    </button>
  );
}

// groundingPolicy.js NEVER_GUESS_FIELDS that stay plain strings — schema
// requires min(1) so an empty string here means the backend genuinely
// couldn't fill it, which is a real gap, not just "not set".
const NEVER_EMPTY_STRING_FIELDS = new Set(["registrationNumber", "batchNo", "expiryDate"]);

function EstimatedPill() {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">{t("labelFieldsPanel.estimated")}</span>
  );
}

function ProductNameMasthead({ value }) {
  if (!value?.translations) return <p className="text-sm text-gray-400 italic">{t("labelFieldsPanel.productNameNotSet")}</p>;
  return (
    <>
      {value.translations.en && (
        <p className="text-2xl font-black uppercase tracking-wide text-gray-900">{value.translations.en}</p>
      )}
      {value.translations.ar && (
        <p className="text-lg font-bold text-gray-700 mt-1" dir="rtl">{value.translations.ar}</p>
      )}
    </>
  );
}

function FieldRow({ field, labelData, fieldVerdicts, fieldProvenance, isEstimated, detailedView, onEditField, onAskAssistant }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{field.label}</span>
          <ProvenanceBadge entries={fieldProvenance} detailed={detailedView} />
          {isEstimated && <EstimatedPill />}
        </div>
        <div className="flex items-center gap-0.5">
          {onAskAssistant && (
            <IconButton tone="purple" title={t("labelFieldsPanel.askAssistantToReviewEdit")} onClick={() => onAskAssistant(t("labelFieldsPanel.pleaseHelpMeUpdateOr", { label: field.label }))}>
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </IconButton>
          )}
          {onEditField && (
            <IconButton tone="blue" title={t("labelFieldsPanel.edit")} onClick={() => onEditField(field)}>
              <Pencil className="w-3.5 h-3.5" />
            </IconButton>
          )}
        </div>
      </div>

      {isEstimated && <div className="mt-1.5"><EstimatedSourceInfo entries={fieldProvenance} /></div>}

      <div className="mt-1">
        <FieldValue field={field} value={labelData[field.path]} provenance={fieldProvenance} />
      </div>

      {detailedView && fieldVerdicts.length > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
          <VerdictList verdicts={fieldVerdicts} detailedView={detailedView} onEditField={onEditField} />
        </div>
      )}
    </div>
  );
}

// The core detail surface: every label field alongside its per-field verdicts and
// provenance, laid out like the printed label itself — a title masthead followed by
// the same panels (composition, usage, safety, storage, regulatory) a real product
// label carries — rather than a flat settings-style field list.
export default function LabelFieldsPanel({ labelData, verdicts, provenance, onEditField, onAskAssistant, detailedView = false, showOnlyEstimated = false }) {
  if (!labelData) return null;
  const estimatedFields = labelData.estimatedFields || [];

  let rows = LABEL_FIELD_CATALOG.filter((f) => fieldHasContent(labelData, f) || provenanceForField(provenance, f.path)?.[0]?.refusalReason);
  if (showOnlyEstimated) {
    rows = rows.filter(f => estimatedFields.includes(f.path));
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 italic">{t("labelFieldsPanel.thisLabelHasNoPopulated")}</p>;
  }

  const titleField = rows.find((f) => f.path === "productName");
  const bodyRows = rows.filter((f) => f.path !== "productName");
  const sections = LABEL_SECTIONS
    .map((section) => ({ ...section, rows: bodyRows.filter((f) => f.section === section.key) }))
    .filter((section) => section.rows.length > 0);

  const isTitleEstimated = titleField && estimatedFields.includes(titleField.path);
  const titleProvenance = titleField ? provenanceForField(provenance, titleField.path) : [];

  return (
    <div className="rounded-lg border-2 border-gray-900 bg-white shadow-sm overflow-hidden">
      {titleField && (
        <div className="relative px-6 py-6 text-center border-b-2 border-gray-900 bg-gray-50/60">
          <div className="absolute top-3 end-3 flex items-center gap-1">
            {isTitleEstimated && <EstimatedPill />}
            {onAskAssistant && (
              <IconButton tone="purple" title={t("labelFieldsPanel.askAssistantToReviewEdit")} onClick={() => onAskAssistant(t("labelFieldsPanel.pleaseHelpMeUpdateOr", { label: titleField.label }))}>
                <MessageSquarePlus className="w-3.5 h-3.5" />
              </IconButton>
            )}
            {onEditField && (
              <IconButton tone="blue" title={t("labelFieldsPanel.edit")} onClick={() => onEditField(titleField)}>
                <Pencil className="w-3.5 h-3.5" />
              </IconButton>
            )}
          </div>
          <ProductNameMasthead value={labelData[titleField.path]} />
          {isTitleEstimated && (
            <div className="mt-3 max-w-md mx-auto text-start">
              <EstimatedSourceInfo entries={titleProvenance} />
            </div>
          )}
        </div>
      )}

      {sections.map((section) => (
        <div key={section.key} className="border-t border-gray-200 first:border-t-0">
          <div className="px-6 pt-4 pb-1 bg-gray-50/40">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-400">{section.label}</h3>
          </div>
          <div className="divide-y divide-gray-100 px-6 pb-4">
            {section.rows.map((field) => (
              <FieldRow
                key={field.path}
                field={field}
                labelData={labelData}
                fieldVerdicts={verdictsForField(verdicts, field.path)}
                fieldProvenance={provenanceForField(provenance, field.path)}
                isEstimated={estimatedFields.includes(field.path) || provenanceForField(provenance, field.path).some((p) => p.estimated)}
                detailedView={detailedView}
                onEditField={onEditField}
                onAskAssistant={onAskAssistant}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
