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
  { path: "productName", label: "Product Name", type: "localized" },
  { path: "pharmaceuticalForm", label: "Pharmaceutical Form", type: "localized", section: "composition" },
  { path: "strength", label: "Strength", type: "localized", section: "composition" },
  { path: "feedClassification", label: "Feed Classification", type: "localized", section: "composition" },
  { path: "activeIngredients", label: "Active Ingredients", type: "ingredients", section: "composition" },
  { path: "excipients", label: "Excipients", type: "localizedArray", section: "composition" },
  { path: "analysis", label: "Analysis", type: "analysis", section: "composition" },
  { path: "targetAnimalSpecies", label: "Target Animal Species", type: "targetSpecies", section: "usage" },
  { path: "aimOfUse", label: "Aim of Use", type: "localized", section: "usage" },
  { path: "indications", label: "Indications", type: "localizedArray", section: "usage" },
  { path: "routeOfAdministration", label: "Route of Administration", type: "localized", section: "usage" },
  { path: "directionOfUse", label: "Direction of Use", type: "localized", section: "usage" },
  { path: "contraindications", label: "Contraindications", type: "localized", section: "safety" },
  { path: "warnings", label: "Warnings", type: "localizedArray", section: "safety" },
  { path: "sideEffects", label: "Side Effects", type: "localized", section: "safety" },
  { path: "withdrawalPeriod", label: "Withdrawal Period", type: "localized", section: "safety" },
  { path: "userSafety", label: "User Safety", type: "localizedArray", section: "safety" },
  { path: "keepOutOfReachOfChildren", label: "Keep Out of Reach of Children", type: "boolean", section: "safety" },
  { path: "storage", label: "Storage", type: "localized", section: "storage" },
  { path: "shelfLifeAfterOpening", label: "Shelf Life After Opening", type: "localized", section: "storage" },
  { path: "disposal", label: "Disposal", type: "localized", section: "storage" },
  { path: "netWeight", label: "Net Weight", type: "localized", section: "storage" },
  { path: "packaging", label: "Packaging", type: "localized", section: "storage" },
  { path: "registrationNumber", label: "Registration Number", type: "string", section: "regulatory" },
  { path: "marketingAuthorisationHolder", label: "Marketing Authorisation Holder", type: "localized", section: "regulatory" },
  { path: "manufacturer", label: "Manufacturer", type: "localized", section: "regulatory" },
  { path: "importer", label: "Importer", type: "localized", section: "regulatory" },
  { path: "countryOfProduction", label: "Country of Production", type: "localized", section: "regulatory" },
  { path: "batchNo", label: "Batch No.", type: "string", section: "regulatory" },
  { path: "productionDate", label: "Production Date", type: "string", section: "regulatory" },
  { path: "expiryDate", label: "Expiry Date", type: "string", section: "regulatory" },
  { path: "prescriptionStatus", label: "Prescription Status", type: "string", section: "regulatory" },
  { path: "usageDeclaration", label: "Usage Declaration", type: "localizedArray", section: "regulatory" },
];

export const LABEL_SECTIONS = [
  { key: "composition", label: "Composition" },
  { key: "usage", label: "Species, Indications & Directions" },
  { key: "safety", label: "Warnings & Safety" },
  { key: "storage", label: "Storage & Packaging" },
  { key: "regulatory", label: "Regulatory & Manufacturer Information" },
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
