// What a request's certificate still needs, worded in the UI language from the backend's codes
// (GET /certificate-requests/:id → rows[].cells[code].missing[{ code, label?, fields? }]). An unknown code
// falls back to the backend's own text.
import { has, pickText, t } from "../i18n";

/** one missing item of a cell → a short sentence */
export function needText(m) {
  if (!m) return "";
  const key = `requestNeeds.code.${m.code}`;
  if (m.code === "value" && m.label) return t("requestNeeds.code.valueOf", { label: m.label });
  if ((m.code === "no_template" || m.code === "not_ready") && m.type) return t("requestNeeds.code.templateNotReady", { type: m.type });
  if (has(key)) return t(key, { n: m.fields?.length || 0 });
  return pickText(m);
}

const CERT_DONE = new Set(["approved", "exported"]);
const REVIEW = new Set(["draft", "in_review", "awaiting_authorization"]);

/**
 * A request's detail → what is waiting, grouped: [{ kind, type?, count, label?, text }], most blocking first.
 * One line per (kind, type): "3 COAs need lab results", "HC needs Consignee name".
 */
export function waitingFor(detail) {
  const groups = new Map();
  const add = (kind, type, extra = {}) => {
    const k = `${kind}|${type || ""}|${extra.label || ""}`;
    const g = groups.get(k) || { kind, type, count: 0, ...extra };
    g.count++;
    groups.set(k, g);
  };
  for (const row of detail?.rows || []) {
    if (row.match !== "matched") add("product", null);
    for (const [type, cell] of Object.entries(row.cells || {})) {
      if (CERT_DONE.has(cell.status)) continue;
      const missing = cell.missing || [];
      if (missing.length) {
        for (const m of missing) {
          if (m.code === "lab_report") add("lab", type);
          else if (m.code === "value") add("value", type, { label: m.label });
          else if (m.code === "failed") add("failed", type);
          else if (m.code === "no_template" || m.code === "not_ready" || m.code === "no_type") add("template", type);
          else if (m.code === "layout") add("layout", type);
          else if (m.code === "composition") add("composition", type);
          else if (m.code === "not_generated") add("generate", type);
          else if (m.code !== "unmatched" && m.code !== "new_pack") add("other", type, { label: needText(m) });
        }
      } else if (REVIEW.has(cell.status)) add("review", type);
    }
  }
  const ORDER = ["product", "failed", "template", "lab", "value", "composition", "layout", "generate", "review", "other"];
  return [...groups.values()]
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
    .map((g) => ({ ...g, text: t(`requestNeeds.group.${g.kind}`, { count: g.count, type: g.type || "", label: g.label || "" }) }));
}

/** the request has its certificates made, none waiting: a ZIP / combined PDF can be downloaded */
export const readyToDownload = (detail) => !!detail?.batch && waitingFor(detail).length === 0;
