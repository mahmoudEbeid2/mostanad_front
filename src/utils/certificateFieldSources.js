// Labels and grouping for the field source picker (plan §8.2, §10.3). The
// catalogue itself always comes from GET /certificate-field-sources, so the
// picker can never offer a source the backend doesn't resolve.

/** snake_case key from a label: "Batch No." → "batch_no" */
export function slugKey(text) {
  const s = String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, 50);
  return s || "field";
}

export const optionValue = (source) => (source?.path ? `${source.kind}:${source.path}` : source?.kind || "");

/** react-select grouped options from the catalogue. */
export function sourceOptions(catalogue) {
  if (!catalogue) return [];
  const pathKinds = catalogue.kinds.filter((k) => k.paths);
  const other = catalogue.kinds.filter((k) => !k.paths);
  return [
    ...pathKinds.map((k) => ({
      label: k.label,
      options: k.paths.map((p) => ({ value: `${k.kind}:${p.path}`, label: p.label, source: { kind: k.kind, path: p.path }, type: p.type, group: k.label })),
    })),
    {
      label: "Other",
      options: other.map((k) => ({ value: k.kind, label: k.label, source: { kind: k.kind }, type: k.type || "string", group: "Other", description: k.description })),
    },
  ];
}

export function findOption(options, source) {
  const v = optionValue(source);
  for (const g of options) {
    const hit = g.options.find((o) => o.value === v);
    if (hit) return hit;
  }
  return null;
}

/** Short chip text: "Invoice line · Batch number" */
export function sourceLabel(options, source) {
  if (!source) return "—";
  if (source.kind === "static") return `Fixed · “${source.text || ""}”`;
  if (source.kind === "template") return `Combination · ${source.template || ""}`;
  const o = findOption(options, source);
  return o ? (o.group === "Other" ? o.label : `${o.group} · ${o.label}`) : `${source.kind}${source.path ? ` · ${source.path}` : ""}`;
}

/** Value type a source yields — decides which format options are offered. */
export function sourceType(options, source) {
  if (!source) return "string";
  if (source.kind === "today") return "date";
  return findOption(options, source)?.type || "string";
}

export const DATE_PATTERNS = ["MM/YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "DD.MM.YYYY", "YYYY-MM-DD", "DD MMM YYYY", "MMM YYYY", "MM/YY"];
