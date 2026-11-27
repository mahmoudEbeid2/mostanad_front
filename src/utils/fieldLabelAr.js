import { isAr, t } from "../i18n";
// A certificate field's label in the interface language (27 Nov QA: "Ingredient 13", "pH result" on an
// Arabic screen). The same known labels the server translates for the chat (batchAnswer.fieldLabelAr);
// anything else keeps its own label — a company's own wording is never guessed at.

const LABEL_AR = [
  [/^Ingredient (\d+) amount$/i, (m) => t("fieldLabelAr.ingredientAmount", { v: m[1] })],
  [/^Ingredient (\d+) unit$/i, (m) => t("fieldLabelAr.ingredientUnit", { v: m[1] })],
  [/^Ingredient (\d+)$/i, (m) => t("fieldLabelAr.ingredient", { v: m[1] })],
  [/^Composition basis$/i, () => t("fieldLabelAr.compositionBasis")],
  [/^Batch (?:number|no\.?)$/i, () => t("fieldLabelAr.batchNumber")],
  [/^Batch size$/i, () => t("fieldLabelAr.batchSize")],
  [/^(?:Manufacturing|Production) date$/i, () => t("fieldLabelAr.productionDate")],
  [/^Expiry date$/i, () => t("fieldLabelAr.expiryDate")],
  [/^Document number$/i, () => t("fieldLabelAr.certificateNumber")],
  [/^Issue date$/i, () => t("fieldLabelAr.issueDate")],
  [/^Product name$/i, () => t("fieldLabelAr.productName")],
  [/^Product form$/i, () => t("fieldLabelAr.productFormAsOnThe")],
  [/^Form$/i, () => t("fieldLabelAr.form")],
  [/^Category$/i, () => t("fieldLabelAr.category")],
  [/^Packing(?: size)?$/i, () => t("fieldLabelAr.pack")],
  [/^Validity$/i, () => t("fieldLabelAr.shelfLife")],
  [/^Consignee name$/i, () => t("fieldLabelAr.consigneeName")],
  [/^Consignee address(?: \(line \d+\))?$/i, () => t("fieldLabelAr.consigneeAddress")],
  [/^Consignee country$/i, () => t("fieldLabelAr.consigneeCountry")],
  [/^Consignee phone$/i, () => t("fieldLabelAr.consigneePhone")],
  [/^Exporter name$/i, () => t("fieldLabelAr.exporterName")],
  [/^Exporter address(?: \(line \d+\))?$/i, () => t("fieldLabelAr.exporterAddress")],
  [/^Exporter (?:phone)$/i, () => t("fieldLabelAr.exporterPhone")],
  [/^Exporter (?:email)$/i, () => t("fieldLabelAr.exporterEmail")],
  [/^(.+) result$/i, (m) => t("fieldLabelAr.result", { v: m[1] })],
  [/^(.+) specification$/i, (m) => t("fieldLabelAr.spec", { v: m[1] })],
];

export function fieldLabelAr(label) {
  const t = String(label || "").trim();
  if (!isAr) return t;
  for (const [re, ar] of LABEL_AR) {
    const m = t.match(re);
    if (m) return ar(m);
  }
  return t;
}
