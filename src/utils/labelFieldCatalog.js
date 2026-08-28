// UI-side field catalog for the label detail screen, mirroring
// mostanad/src/services/label/schema/labelSchema.js (§6.3). This does not decide
// applicability (that's the backend's fieldCatalog.js, §6.4) — it only decides how
// to RENDER whatever the backend returned, including fields the backend omitted as
// not-applicable for this label.
export const LABEL_FIELD_CATALOG = [
  { path: "productName", label: "Product Name", type: "localized" },
  { path: "pharmaceuticalForm", label: "Pharmaceutical Form", type: "localized" },
  { path: "strength", label: "Strength", type: "localized" },
  { path: "feedClassification", label: "Feed Classification", type: "localized" },
  { path: "activeIngredients", label: "Active Ingredients", type: "ingredients" },
  { path: "excipients", label: "Excipients", type: "localizedArray" },
  { path: "analysis", label: "Analysis", type: "analysis" },
  { path: "targetAnimalSpecies", label: "Target Animal Species", type: "targetSpecies" },
  { path: "aimOfUse", label: "Aim of Use", type: "localized" },
  { path: "indications", label: "Indications", type: "localizedArray" },
  { path: "routeOfAdministration", label: "Route of Administration", type: "localized" },
  { path: "directionOfUse", label: "Direction of Use", type: "localized" },
  { path: "contraindications", label: "Contraindications", type: "localized" },
  { path: "warnings", label: "Warnings", type: "localizedArray" },
  { path: "sideEffects", label: "Side Effects", type: "localized" },
  { path: "withdrawalPeriod", label: "Withdrawal Period", type: "localized" },
  { path: "userSafety", label: "User Safety", type: "localizedArray" },
  { path: "storage", label: "Storage", type: "localized" },
  { path: "shelfLifeAfterOpening", label: "Shelf Life After Opening", type: "localized" },
  { path: "disposal", label: "Disposal", type: "localized" },
  { path: "netWeight", label: "Net Weight", type: "localized" },
  { path: "packaging", label: "Packaging", type: "localized" },
  { path: "registrationNumber", label: "Registration Number", type: "string" },
  { path: "marketingAuthorisationHolder", label: "Marketing Authorisation Holder", type: "localized" },
  { path: "manufacturer", label: "Manufacturer", type: "localized" },
  { path: "importer", label: "Importer", type: "localized" },
  { path: "countryOfProduction", label: "Country of Production", type: "localized" },
  { path: "batchNo", label: "Batch No.", type: "string" },
  { path: "productionDate", label: "Production Date", type: "string" },
  { path: "expiryDate", label: "Expiry Date", type: "string" },
  { path: "prescriptionStatus", label: "Prescription Status", type: "string" },
  { path: "usageDeclaration", label: "Usage Declaration", type: "localizedArray" },
  { path: "keepOutOfReachOfChildren", label: "Keep Out of Reach of Children", type: "boolean" },
];

// Whether a field has any content worth a row — used to skip fully-empty
// not-applicable fields from a screen that otherwise renders ~30 rows.
export function fieldHasContent(labelData, field) {
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
