import { t } from "../i18n";
// UI-side field catalog for the label detail screen, mirroring
// mostanad/src/services/label/schema/labelSchema.js (§6.3). This does not decide
// applicability (that's the backend's fieldCatalog.js, §6.4) — it only decides how
// to RENDER whatever the backend returned, including fields the backend omitted as
// not-applicable for this label.
// `section` groups fields the way a printed product label groups them (composition
// panel, usage panel, safety panel, ...) so the review screen can render a label
// mockup instead of a flat settings-style field list. `productName` has no section —
// it's rendered as the masthead title, not a row.
export const LABEL_FIELD_CATALOG = [
  { path: "productName", label: t("labelFieldCatalog.productName"), type: "localized" },
  { path: "pharmaceuticalForm", label: t("labelFieldCatalog.pharmaceuticalForm"), type: "localized", section: "composition" },
  { path: "strength", label: t("labelFieldCatalog.strength"), type: "localized", section: "composition" },
  { path: "feedClassification", label: t("labelFieldCatalog.feedClassification"), type: "localized", section: "composition" },
  { path: "activeIngredients", label: t("labelFieldCatalog.activeIngredients"), type: "ingredients", section: "composition" },
  { path: "excipients", label: t("labelFieldCatalog.excipients"), type: "localizedArray", section: "composition" },
  { path: "analysis", label: t("labelFieldCatalog.analysis"), type: "analysis", section: "composition" },
  { path: "targetAnimalSpecies", label: t("labelFieldCatalog.targetAnimalSpecies"), type: "targetSpecies", section: "usage" },
  { path: "aimOfUse", label: t("labelFieldCatalog.aimOfUse"), type: "localized", section: "usage" },
  { path: "indications", label: t("labelFieldCatalog.indications"), type: "localizedArray", section: "usage" },
  { path: "routeOfAdministration", label: t("labelFieldCatalog.routeOfAdministration"), type: "localized", section: "usage" },
  { path: "directionOfUse", label: t("labelFieldCatalog.directionOfUse"), type: "localized", section: "usage" },
  { path: "contraindications", label: t("labelFieldCatalog.contraindications"), type: "localized", section: "safety" },
  { path: "warnings", label: t("labelFieldCatalog.warnings"), type: "localizedArray", section: "safety" },
  { path: "sideEffects", label: t("labelFieldCatalog.sideEffects"), type: "localized", section: "safety" },
  { path: "withdrawalPeriod", label: t("labelFieldCatalog.withdrawalPeriod"), type: "localized", section: "safety" },
  { path: "userSafety", label: t("labelFieldCatalog.userSafety"), type: "localizedArray", section: "safety" },
  { path: "keepOutOfReachOfChildren", label: t("labelFieldCatalog.keepOutOfReachOf"), type: "boolean", section: "safety" },
  { path: "storage", label: t("labelFieldCatalog.storage"), type: "localized", section: "storage" },
  { path: "shelfLifeAfterOpening", label: t("labelFieldCatalog.shelfLifeAfterOpening"), type: "localized", section: "storage" },
  { path: "disposal", label: t("labelFieldCatalog.disposal"), type: "localized", section: "storage" },
  { path: "netWeight", label: t("labelFieldCatalog.netWeight"), type: "localized", section: "storage" },
  { path: "packaging", label: t("labelFieldCatalog.packaging"), type: "localized", section: "storage" },
  { path: "registrationNumber", label: t("labelFieldCatalog.registrationNumber"), type: "string", section: "regulatory" },
  { path: "marketingAuthorisationHolder", label: t("labelFieldCatalog.marketingAuthorisationHolder"), type: "localized", section: "regulatory" },
  { path: "manufacturer", label: t("labelFieldCatalog.manufacturer"), type: "localized", section: "regulatory" },
  { path: "importer", label: t("labelFieldCatalog.importer"), type: "localized", section: "regulatory" },
  { path: "countryOfProduction", label: t("labelFieldCatalog.countryOfProduction"), type: "localized", section: "regulatory" },
  { path: "batchNo", label: t("labelFieldCatalog.batchNo"), type: "string", section: "regulatory" },
  { path: "productionDate", label: t("labelFieldCatalog.productionDate"), type: "string", section: "regulatory" },
  { path: "expiryDate", label: t("labelFieldCatalog.expiryDate"), type: "string", section: "regulatory" },
  { path: "prescriptionStatus", label: t("labelFieldCatalog.prescriptionStatus"), type: "string", section: "regulatory" },
  { path: "usageDeclaration", label: t("labelFieldCatalog.usageDeclaration"), type: "localizedArray", section: "regulatory" },
];

export const LABEL_SECTIONS = [
  { key: "composition", label: t("labelFieldCatalog.composition") },
  { key: "usage", label: t("labelFieldCatalog.speciesIndicationsDirections") },
  { key: "safety", label: t("labelFieldCatalog.warningsSafety") },
  { key: "storage", label: t("labelFieldCatalog.storagePackaging") },
  { key: "regulatory", label: t("labelFieldCatalog.regulatoryManufacturerInformation") },
];

// Mirrors groundingPolicy.js's NEVER_GUESS_FIELDS — the backend now always
// generates something for these (grounded, or Tier 6 "estimated" with a real
// value), so an empty-looking value is a genuine gap worth a visible row, not
// a not-applicable field to hide. FieldValue renders the gap explicitly.
const NEVER_HIDE_FIELDS = new Set([
  "strength",
  "activeIngredients",
  "withdrawalPeriod",
  "shelfLifeAfterOpening",
  "registrationNumber",
  "batchNo",
  "expiryDate",
]);

// Whether a field has any content worth a row — used to skip fully-empty
// not-applicable fields from a screen that otherwise renders ~30 rows.
export function fieldHasContent(labelData, field) {
  if (NEVER_HIDE_FIELDS.has(field.path)) return true;
  const v = labelData?.[field.path];
  if (v === null || v === undefined) return false;
  switch (field.type) {
    case "localized":
      return Boolean(v.translations?.en || v.translations?.ar || v.primary);
    case "localizedArray":
      return Array.isArray(v) && v.length > 0;
    case "ingredients":
      return Array.isArray(v) && v.length > 0;
    case "analysis":
      return Boolean(v.items?.length);
    case "targetSpecies":
      return Boolean(v.list?.length);
    case "boolean":
      return true; // always show — a declared false is still meaningful
    case "string":
    default:
      return v !== "";
  }
}

// Verdicts whose path is this field or a nested path under it
// ("activeIngredients[1].amount" belongs to "activeIngredients").
export function verdictsForField(verdicts, fieldPath) {
  if (!verdicts) return [];
  return verdicts.filter(
    (v) => v.path === fieldPath || v.path?.startsWith(`${fieldPath}.`) || v.path?.startsWith(`${fieldPath}[`)
  );
}

// Provenance entries (§14.4) whose key is this field or nested under it.
export function provenanceForField(provenance, fieldPath) {
  if (!provenance) return [];
  return Object.entries(provenance)
    .filter(([key]) => key === fieldPath || key.startsWith(`${fieldPath}.`) || key.startsWith(`${fieldPath}[`))
    .map(([key, entry]) => ({ key, ...entry }));
}
